-- Defines erasure support only; applying this migration does not delete any account.
begin;
create table if not exists public.account_erasure_markers (
  id_hash text primary key check(length(id_hash)=64), created_at timestamptz not null default now()
);
alter table public.account_erasure_markers enable row level security;
revoke all on public.account_erasure_markers from public,anon,authenticated;
grant select,insert on public.account_erasure_markers to service_role;

create or replace view public.career_public_profiles as
select p.* from public.profiles p join auth.users u on u.id=p.id
where u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
  and coalesce(u.raw_app_meta_data->>'account_deletion_pending','false')<>'true';

create or replace function public.account_is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and coalesce(raw_app_meta_data->>'account_deletion_pending','false')<>'true');
$$;
revoke all on function public.account_is_active() from public,anon;
grant execute on function public.account_is_active() to authenticated;
-- Stop concurrent avatar uploads after deletion begins; use the Storage API to remove bytes.
create policy "Active account avatar insert" on storage.objects as restrictive for insert to authenticated with check(public.account_is_active());
create policy "Active account avatar update" on storage.objects as restrictive for update to authenticated using(public.account_is_active()) with check(public.account_is_active());

create function public.erased_identity(value jsonb, uid uuid, alias text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; item record;
begin
 case jsonb_typeof(value)
 when 'object' then
   result:='{}';
   for item in select * from jsonb_each(value) loop
     result:=result||jsonb_build_object(item.key,public.erased_identity(item.value,uid,alias));
   end loop;
   if value->>'id' in (uid::text,'user:'||uid::text) then
     result:=result-array['username','firstName','lastName','first_name','last_name','avatarUrl','avatarPath','avatar_path','stats','metrics','xp'];
     result:=result||jsonb_build_object('id',alias);
     if value ? 'name' then result:=result||jsonb_build_object('name','Deleted player'); end if;
     if value ? 'displayName' then result:=result||jsonb_build_object('displayName','Deleted player'); end if;
   end if;
   return result;
 when 'array' then
   select coalesce(jsonb_agg(public.erased_identity(v,uid,alias) order by ord),'[]') into result from jsonb_array_elements(value) with ordinality x(v,ord);
   return result;
 when 'string' then
   return to_jsonb(replace(replace(value#>>'{}','user:'||uid::text,alias),uid::text,alias));
 else return value;
 end case;
end $$;

create function public.normalize_erased_players(report jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p jsonb; uid uuid; alias text;
begin
 for p in select * from jsonb_array_elements(coalesce(report->'players','[]')) loop
   if p->>'id' ~ '^user:[0-9a-fA-F-]{36}$' then
     uid:=substring(p->>'id' from 6)::uuid;
     if exists(select 1 from public.account_erasure_markers where id_hash=encode(sha256(convert_to(uid::text,'UTF8')),'hex')) then
       alias:='deleted:'||substr(encode(sha256(convert_to((report->>'id')||':'||uid::text,'UTF8')),'hex'),1,32);
       report:=public.erased_identity(report,uid,alias);
     end if;
   end if;
 end loop;
 return report;
end $$;

create function public.prepare_account_erasure(account_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Trusted service required'; end if;
 perform pg_advisory_xact_lock(61730902);
 if exists(select 1 from auth.users where id=account_id and coalesce(raw_app_meta_data->>'account_deletion_pending','false')<>'true') then raise exception 'Deletion not authorized'; end if;
 insert into public.account_erasure_markers(id_hash) values(encode(sha256(convert_to(account_id::text,'UTF8')),'hex')) on conflict do nothing;
end $$;
create function public.anonymize_account_history(account_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Trusted service required'; end if;
 perform pg_advisory_xact_lock(61730902);
 if not exists(select 1 from public.account_erasure_markers where id_hash=encode(sha256(convert_to(account_id::text,'UTF8')),'hex')) then raise exception 'Deletion not authorized'; end if;
 update public.career_matches set report=public.erased_identity(report,account_id,
   'deleted:'||substr(encode(sha256(convert_to(id::text||':'||account_id::text,'UTF8')),'hex'),1,32))
 where report::text like '%'||account_id::text||'%';
end $$;
revoke all on function public.erased_identity(jsonb,uuid,text),public.normalize_erased_players(jsonb),public.prepare_account_erasure(uuid),public.anonymize_account_history(uuid) from public,anon,authenticated;
grant execute on function public.prepare_account_erasure(uuid),public.anonymize_account_history(uuid) to service_role;

-- Preserve the existing metagame calculations; erased seats are anonymous and receive no writes.
create or replace function public.ingest_career_match(report jsonb) returns void language plpgsql security definer set search_path='' as $$
declare gid uuid; rev bigint; old_rev bigint; p jsonb; u uuid; old_metrics jsonb; new_metrics jsonb; agg jsonb;
 k text; n numeric; prev numeric; v numeric; rr jsonb; cfg jsonb; streak integer; best integer; needs_streak boolean := false; old_rounds jsonb; combined_rounds jsonb;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Trusted game service required'; end if;
 report:=public.normalize_erased_players(report);
 if report->>'eligible' is distinct from 'true' or jsonb_array_length(report->'players') not between 2 and 8 then raise exception 'Invalid career match'; end if;
 gid := (report->>'id')::uuid; rev := (report->>'revision')::bigint;
 -- Serialize ingests across rooms: protects multi-user totals, streaks and daily caps without deadlocks.
 perform pg_advisory_xact_lock(61730902);
 select revision, public.career_matches.report->'rounds' into old_rev,old_rounds from public.career_matches where id=gid;
 if old_rev is not null and old_rev>=rev then return; end if;
 if exists(select 1 from public.career_matches where id=gid and status in ('completed','abandoned')) then return; end if;
 if exists(select 1 from jsonb_array_elements(report->'players') x where x->>'id' !~ '^deleted:[0-9a-f]{32}$' and (x->>'id' not like 'user:%' or not exists(select 1 from public.career_public_profiles where id=substring(x->>'id' from 6)::uuid))) then raise exception 'Registered players required'; end if;
 if jsonb_array_length(coalesce(report->'rounds','[]'))=0 then combined_rounds:=coalesce(old_rounds,'[]');
 else
 select coalesce(jsonb_agg(value order by (value->>'round')::integer),'[]') into combined_rounds from (
   select distinct on ((value->>'round')::integer) value from jsonb_array_elements(coalesce(old_rounds,'[]') || coalesce(report->'rounds','[]'))
   order by (value->>'round')::integer
 ) rounds;
 end if;
 insert into public.career_matches values(gid,rev,to_timestamp((report->>'startedAt')::numeric/1000),
 case when report->>'completedAt' is not null then to_timestamp((report->>'completedAt')::numeric/1000) end,report->>'status',
 jsonb_build_object('id',gid,'startedAt',report->'startedAt','completedAt',report->'completedAt','status',report->'status','settings',report->'settings','rounds',combined_rounds,'players',report->'players'))
 on conflict(id) do update set revision=excluded.revision,completed_at=excluded.completed_at,status=excluded.status,report=excluded.report;
 for p in select * from jsonb_array_elements(report->'players') where value->>'id' !~ '^deleted:[0-9a-f]{32}$' loop
   u := substring(p->>'id' from 6)::uuid;
   insert into public.career_totals(user_id) values(u) on conflict do nothing;
   select metrics into old_metrics from public.career_match_players where game_id=gid and user_id=u;
   old_metrics := coalesce(old_metrics,'{}'); new_metrics := p->'stats';
   if coalesce((new_metrics->>'gamesAbandoned')::integer,0)>coalesce((old_metrics->>'gamesAbandoned')::integer,0) then needs_streak:=true; end if;
   select metrics into agg from public.career_totals where user_id=u for update;
   for k,n in select key,value::numeric from jsonb_each_text(new_metrics) loop
     if n<0 or n>1e15 then raise exception 'Invalid metric'; end if;
     prev := coalesce((old_metrics->>k)::numeric,0);
     if k in ('lowestHand','fastestMs') then v := least(coalesce((agg->>k)::numeric,n),n);
     elsif k in ('highestHand','slowestMs','maxPenalty') then v := greatest(coalesce((agg->>k)::numeric,0),n);
     else
       if n<prev then raise exception 'Non-monotonic counter'; end if;
       v := coalesce((agg->>k)::numeric,0)+n-prev;
     end if;
     agg := jsonb_set(agg,array[k],to_jsonb(v),true);
   end loop;
   update public.career_totals set metrics=agg,updated_at=now() where user_id=u;
   insert into public.career_match_players values(gid,u,p->>'outcome',case when p->>'abandonedAt' is not null then to_timestamp((p->>'abandonedAt')::numeric/1000) end,(p->>'score')::integer,(p->>'rank')::integer,new_metrics)
   on conflict(game_id,user_id) do update set outcome=excluded.outcome,abandoned_at=excluded.abandoned_at,score=excluded.score,final_rank=excluded.final_rank,metrics=excluded.metrics;
   for rr in select * from jsonb_array_elements(report->'rounds') loop
     if (rr->'eligibleIds') ? (p->>'id') then perform public.career_award(u,gid,(rr->>'round')::integer,'round'); end if;
   end loop;
   if report->>'status'='completed' and p->>'outcome' in ('won','lost') then
     perform public.career_award(u,gid,0,'game');
     if p->>'outcome'='won' then perform public.career_award(u,gid,0,'victory'); end if;
   end if;
 end loop;
 if report->>'status'='completed' then
   insert into public.career_opponents(user_id,opponent_id,games,wins,losses,last_game)
   select a.user_id,b.user_id,1,case when a.outcome='won' then 1 else 0 end,case when b.outcome='won' then 1 else 0 end,m.completed_at
   from public.career_match_players a join public.career_match_players b on a.game_id=b.game_id and a.user_id<>b.user_id
   join public.career_matches m on m.id=a.game_id where a.game_id=gid
   on conflict(user_id,opponent_id) do update set games=public.career_opponents.games+1,wins=public.career_opponents.wins+excluded.wins,
     losses=public.career_opponents.losses+excluded.losses,last_game=greatest(public.career_opponents.last_game,excluded.last_game);
 end if;
 -- Calculate streaks in official completion order, including delayed reports.
 if report->>'status' in ('completed','abandoned') or needs_streak then
   for p in select * from jsonb_array_elements(report->'players') where value->>'id' !~ '^deleted:[0-9a-f]{32}$' loop
     u := substring(p->>'id' from 6)::uuid; streak:=0; best:=0;
     for rr in select jsonb_build_object('result',mp.outcome) from public.career_match_players mp join public.career_matches m on m.id=mp.game_id
       where mp.user_id=u and (m.status in ('completed','abandoned') or mp.outcome='abandoned') order by coalesce(mp.abandoned_at,m.completed_at,m.started_at),m.id loop
       if rr->>'result'='won' then streak:=streak+1; best:=greatest(best,streak); else streak:=0; end if;
     end loop;
     update public.career_totals set metrics=metrics || jsonb_build_object('currentWinStreak',streak,'bestWinStreak',best) where user_id=u;
   end loop;
 end if;
end; $$;
revoke all on function public.ingest_career_match(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_career_match(jsonb) to service_role;


create function public.account_erasure_ready() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.role(),'')='service_role' and to_regprocedure('public.prepare_account_erasure(uuid)') is not null
 and to_regprocedure('public.anonymize_account_history(uuid)') is not null
 and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Active account avatar insert');
$$;
revoke all on function public.account_erasure_ready() from public,anon,authenticated;
grant execute on function public.account_erasure_ready() to service_role;
commit;
