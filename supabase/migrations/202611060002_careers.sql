-- Forward-only metagame migration. Apply after the profiles and avatar migrations.
begin;
alter table public.profiles add column if not exists username text;
update public.profiles set username = 'lc_' || replace(id::text, '-', '') where username is null;
alter table public.profiles alter column username set not null;
create unique index if not exists profiles_username_unique on public.profiles(username);
create index if not exists profiles_name_search on public.profiles(lower(display_name) text_pattern_ops);
create or replace function public.assign_player_username() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=new.id and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required'; end if;
 new.username := 'lc_' || replace(new.id::text, '-', ''); return new; end; $$;
create trigger assign_player_username before insert on public.profiles for each row execute function public.assign_player_username();
-- Public identifiers are stable. Clients cannot edit them or creation dates.
revoke insert, update on public.profiles from authenticated;
grant insert(id,display_name), update(display_name,avatar_path,last_active_at) on public.profiles to authenticated;

create table public.career_config (
  id boolean primary key default true check(id),
  rewards jsonb not null default '{"round":10,"game":25,"victory":75,"levelBase":50,"dailyRounds":200,"dailyGames":40}'
);
insert into public.career_config(id) values(true);
create table public.career_totals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp bigint not null default 0 check(xp>=0),
  metrics jsonb not null default '{}', updated_at timestamptz not null default now()
);
create index career_ranking on public.career_totals(xp desc, ((metrics->>'gamesWon')::bigint) desc, user_id);
create table public.career_matches (
  id uuid primary key, revision bigint not null, started_at timestamptz not null,
  completed_at timestamptz, status text not null check(status in ('active','completed','abandoned')),
  report jsonb not null
);
create table public.career_match_players (
  game_id uuid references public.career_matches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  outcome text not null, abandoned_at timestamptz, score integer not null, final_rank integer, metrics jsonb not null,
  primary key(game_id,user_id)
);
create index career_person_history on public.career_match_players(user_id,game_id);
create index career_completion on public.career_matches(completed_at desc,id);
create table public.career_opponents (
  user_id uuid references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete cascade,
  games bigint not null default 0,wins bigint not null default 0,losses bigint not null default 0,last_game timestamptz not null,
  primary key(user_id,opponent_id),check(user_id<>opponent_id)
);
create index career_frequent_opponents on public.career_opponents(user_id,games desc,opponent_id);
create table public.xp_transactions (
  user_id uuid references public.profiles(id) on delete cascade,
  game_id uuid references public.career_matches(id) on delete cascade,
  round_number integer not null default 0,
  event_type text not null check(event_type in ('round','game','victory')),
  xp_amount integer not null check(xp_amount>0), xp_before bigint not null, xp_after bigint not null, created_at timestamptz not null default now(),
  primary key(user_id,game_id,round_number,event_type)
);
create index xp_daily_limit on public.xp_transactions(user_id,event_type,created_at);
create table public.buddy_requests (
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(sender_id,receiver_id), check(sender_id<>receiver_id)
);
create unique index buddy_request_pair on public.buddy_requests(least(sender_id,receiver_id),greatest(sender_id,receiver_id));
create table public.buddy_relationships (
  user_a uuid references public.profiles(id) on delete cascade,
  user_b uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_a,user_b), check(user_a<user_b)
);
create table public.player_blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index buddy_incoming on public.buddy_requests(receiver_id,sender_id);
create index buddy_second_player on public.buddy_relationships(user_b,user_a);
create index blocked_reverse on public.player_blocks(blocked_id,blocker_id);
create view public.career_public_profiles as select p.* from public.profiles p join auth.users u on u.id=p.id where u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
revoke all on public.career_public_profiles from public,anon,authenticated;
-- All access is through bounded, allowlisted RPCs. No browser can mutate statistics.
do $$ declare t text; begin
  foreach t in array array['career_config','career_totals','career_matches','career_match_players','career_opponents','xp_transactions','buddy_requests','buddy_relationships','player_blocks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
end $$;

create function public.career_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create function public.career_relation(a uuid,b uuid) returns text language sql stable security definer set search_path='' as $$
 select case when public.career_blocked(a,b) then 'blocked'
 when exists(select 1 from public.buddy_relationships where user_a=least(a,b) and user_b=greatest(a,b)) then 'accepted'
 when exists(select 1 from public.buddy_requests where sender_id=a and receiver_id=b) then 'outgoing'
 when exists(select 1 from public.buddy_requests where sender_id=b and receiver_id=a) then 'incoming' else 'none' end;
$$;
create function public.career_player(target uuid, viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,'avatarPath',p.avatar_path,
 'createdAt',p.created_at,'levelBase',(select (rewards->>'levelBase')::integer from public.career_config where id),'xp',coalesce(t.xp,0),'gamesWon',coalesce((t.metrics->>'gamesWon')::bigint,0),
 'gamesPlayed',coalesce((t.metrics->>'gamesPlayed')::bigint,0),
 'rank',(select count(*)+1 from public.career_public_profiles p2 left join public.career_totals t2 on p2.id=t2.user_id
 where
 (coalesce(t2.xp,0)>coalesce(t.xp,0) or (coalesce(t2.xp,0)=coalesce(t.xp,0) and
 (coalesce((t2.metrics->>'gamesWon')::bigint,0)>coalesce((t.metrics->>'gamesWon')::bigint,0) or
 (coalesce((t2.metrics->>'gamesWon')::bigint,0)=coalesce((t.metrics->>'gamesWon')::bigint,0) and p2.id<p.id))))))
 from public.career_public_profiles p left join public.career_totals t on t.user_id=p.id
 where p.id=target and not public.career_blocked(viewer,p.id);
$$;

-- Service-only, idempotent awards with a central config and bounded daily rewards.
create function public.career_award(u uuid,g uuid,r integer,kind text) returns void language plpgsql security definer set search_path='' as $$
declare config jsonb; amount integer; limit_count integer; old_xp bigint;
begin
 select rewards into config from public.career_config where id;
 amount := (config->>kind)::integer;
 if kind <> 'victory' then
   limit_count := (config->>case when kind='round' then 'dailyRounds' else 'dailyGames' end)::integer;
   if (select count(*) from public.xp_transactions where user_id=u and event_type=kind and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=limit_count then return; end if;
 end if;
 if kind='victory' and not exists(select 1 from public.xp_transactions where user_id=u and game_id=g and event_type='game') then return; end if;
 select xp into old_xp from public.career_totals where user_id=u;
 insert into public.xp_transactions values(u,g,r,kind,amount,old_xp,old_xp+amount,now()) on conflict do nothing;
 if found then update public.career_totals set xp=xp+amount,updated_at=now() where user_id=u; end if;
end; $$;

create function public.ingest_career_match(report jsonb) returns void language plpgsql security definer set search_path='' as $$
declare gid uuid; rev bigint; old_rev bigint; p jsonb; u uuid; old_metrics jsonb; new_metrics jsonb; agg jsonb;
 k text; n numeric; prev numeric; v numeric; rr jsonb; cfg jsonb; streak integer; best integer; needs_streak boolean := false; old_rounds jsonb; combined_rounds jsonb;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Trusted game service required'; end if;
 if report->>'eligible' is distinct from 'true' or jsonb_array_length(report->'players') not between 2 and 8 then raise exception 'Invalid career match'; end if;
 gid := (report->>'id')::uuid; rev := (report->>'revision')::bigint;
 -- Serialize ingests across rooms: protects multi-user totals, streaks and daily caps without deadlocks.
 perform pg_advisory_xact_lock(61730902);
 select revision, public.career_matches.report->'rounds' into old_rev,old_rounds from public.career_matches where id=gid;
 if old_rev is not null and old_rev>=rev then return; end if;
 if exists(select 1 from public.career_matches where id=gid and status in ('completed','abandoned')) then return; end if;
 if exists(select 1 from jsonb_array_elements(report->'players') x where x->>'id' not like 'user:%' or not exists(select 1 from public.career_public_profiles where id=substring(x->>'id' from 6)::uuid)) then raise exception 'Registered players required'; end if;
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
 for p in select * from jsonb_array_elements(report->'players') loop
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
   for p in select * from jsonb_array_elements(report->'players') loop
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

create function public.career_report(g uuid,viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select (m.report - 'players') || jsonb_build_object('xp',(select coalesce(sum(xp_amount),0) from public.xp_transactions where game_id=g and user_id=viewer),'players',
   (select jsonb_agg(jsonb_build_object('id',p->'id','name',p->'name','score',p->'score','rank',p->'rank','outcome',p->'outcome','elimination',p->'elimination','stats',case when p->>'id'='user:' || viewer::text then p->'stats' else '{}'::jsonb end)) from jsonb_array_elements(m.report->'players') p))
 from public.career_matches m where m.id=g and exists(select 1 from public.career_match_players where game_id=g and user_id=viewer);
$$;
create function public.career_api(operation text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); target uuid; target_name text; result jsonb; config jsonb; off integer; scope text; rel text; action text; data jsonb;
begin
 select rewards - 'dailyRounds' - 'dailyGames' into config from public.career_config where id;
 if me is not null and not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required'; end if;
 if operation not in ('leaderboard','public','search') and me is null then raise exception 'Registered account required'; end if;
 if operation='relationship' then
   target := (args->>'id')::uuid; action:=args->>'action';
   if target=me or not exists(select 1 from public.career_public_profiles where id=target) then raise exception 'Choose another registered player'; end if;
   perform pg_advisory_xact_lock(hashtextextended(least(me,target)::text || greatest(me,target)::text,0));
   rel:=public.career_relation(me,target);
   if action='block' then
     delete from public.buddy_requests where (sender_id=me and receiver_id=target) or (sender_id=target and receiver_id=me);
     delete from public.buddy_relationships where user_a=least(me,target) and user_b=greatest(me,target);
     insert into public.player_blocks values(me,target,now()) on conflict do nothing;
   elsif action='unblock' then delete from public.player_blocks where blocker_id=me and blocked_id=target;
   elsif rel='blocked' then raise exception 'This relationship is unavailable';
   elsif action='request' then
     if rel<>'none' then raise exception 'A request or buddy relationship already exists'; end if;
     if (select count(*) from public.buddy_requests where sender_id=me)>=50 then raise exception 'Too many pending requests'; end if;
     insert into public.buddy_requests values(me,target,now());
   elsif action='accept' and rel='incoming' then
     delete from public.buddy_requests where sender_id=target and receiver_id=me;
     insert into public.buddy_relationships values(least(me,target),greatest(me,target),now());
   elsif action='decline' and rel='incoming' then delete from public.buddy_requests where sender_id=target and receiver_id=me;
   elsif action='cancel' and rel='outgoing' then delete from public.buddy_requests where sender_id=me and receiver_id=target;
   elsif action='remove' and rel='accepted' then delete from public.buddy_relationships where user_a=least(me,target) and user_b=greatest(me,target);
   else raise exception 'That buddy action is unavailable'; end if;
   return jsonb_build_object('relationship',public.career_relation(me,target));
 end if;
 if operation='leaderboard' then
   off:=greatest(0,least(coalesce((args->>'offset')::integer,0),10000)); scope:=coalesce(args->>'scope','global');
   if scope not in ('global','buddies') then raise exception 'Unknown ranking'; end if;
   if scope='buddies' and me is null then raise exception 'Registered account required'; end if;
   select coalesce(jsonb_agg(player order by position),'[]') into data from (
     select public.career_player(id,me) || jsonb_build_object('rank',position) as player,position from (
       select p.id,row_number() over(order by coalesce(t.xp,0) desc,coalesce((t.metrics->>'gamesWon')::bigint,0) desc,p.id) as position
       from public.career_public_profiles p left join public.career_totals t on t.user_id=p.id where (scope='global' or p.id=me or public.career_relation(me,p.id)='accepted')
     ) ranks where not public.career_blocked(me,id) order by position limit 11 offset off
   ) rows;
   result:=jsonb_build_object('players',case when jsonb_array_length(data)>10 then data-10 else data end,'more',jsonb_array_length(data)>10,'me',public.career_player(me,me));
   if scope='buddies' and me is not null then
     select result || jsonb_build_object('me', public.career_player(me,me) || jsonb_build_object('rank',ranked.position)) into result
     from (
       select p.id,row_number() over(order by coalesce(t.xp,0) desc,coalesce((t.metrics->>'gamesWon')::bigint,0) desc,p.id) as position
       from public.career_public_profiles p left join public.career_totals t on p.id=t.user_id
       where p.id=me or public.career_relation(me,p.id)='accepted'
     ) ranked where ranked.id=me;
   end if;
   return result;
 end if;
 if operation='search' then
   target_name:=btrim(coalesce(args->>'query',''));
   if char_length(target_name)<2 then return '[]'; end if;
   if char_length(target_name)>64 then raise exception 'Search is too long'; end if;
   select coalesce(jsonb_agg(public.career_player(p.id,me) || jsonb_build_object('relationship',public.career_relation(me,p.id))),'[]') into result from (
    select id from public.career_public_profiles where (lower(display_name) like replace(replace(replace(lower(target_name),'\','\\'),'%','\%'),'_','\_') || '%' escape '\' or username=lower(target_name)) and not public.career_blocked(me,id) order by username limit 20
   ) p;
   return result;
 end if;
 if operation='buddies' then
   select coalesce(jsonb_agg(public.career_player(p.id,me) || jsonb_build_object('relationship',public.career_relation(me,p.id))),'[]') into data from public.career_public_profiles p
    where p.id in (
      select case when user_a=me then user_b else user_a end from public.buddy_relationships where user_a=me or user_b=me
      union select receiver_id from public.buddy_requests where sender_id=me
      union select sender_id from public.buddy_requests where receiver_id=me
    ) and public.career_relation(me,p.id) in ('incoming','outgoing','accepted');
   return jsonb_build_object('players',data,'blocked',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'displayName',p.display_name,'username',p.username)),'[]') from public.player_blocks b join public.career_public_profiles p on p.id=b.blocked_id where b.blocker_id=me));
 end if;
 if operation='reward' then
   select coalesce(jsonb_agg(jsonb_build_object('type',event_type,'amount',xp_amount,'round',round_number,'before',xp_before,'after',xp_after)),'[]') into data
    from public.xp_transactions where user_id=me and game_id=(args->>'game')::uuid and (round_number=coalesce((args->>'round')::integer,0) or event_type in ('game','victory'));
   return jsonb_build_object('awards',data,'profile',public.career_player(me,me),'config',config);
 end if;
 if operation='game' then
   select public.career_report(m.id,me) into result from public.career_matches m join public.career_match_players mp on mp.game_id=m.id
    where m.id=(args->>'game')::uuid and mp.user_id=me;
   if result is null then raise exception 'Game report unavailable'; end if;
   -- Reports contain only official scores, counters, and display names, never hands.
   return result;
 end if;
 if operation in ('profile','public') then
   if args->>'username' is not null then select id into target from public.career_public_profiles where username=args->>'username'; else target:=me; end if;
   data:=public.career_player(target,me);
   if data is null then raise exception 'Player unavailable'; end if;
   result:=jsonb_build_object('profile',data,'own',target=me,'relationship',public.career_relation(me,target),'config',config);
   if target=me then
     select result || jsonb_build_object('statistics',coalesce((select metrics from public.career_totals where user_id=me),'{}'),
       'games',coalesce((select jsonb_agg(report order by completed_at desc) from (
         select (public.career_report(m.id,me) - 'rounds') || jsonb_build_object('roundCount',jsonb_array_length(m.report->'rounds'),'rounds','[]'::jsonb) as report,m.completed_at
         from public.career_matches m join public.career_match_players mp on mp.game_id=m.id where mp.user_id=me order by m.started_at desc limit 20 offset greatest(0,least(coalesce((args->>'offset')::integer,0),10000))
       ) recent),'[]')) into result;
     select coalesce(jsonb_agg(public.career_player(o.user_id,me) || jsonb_build_object('gamesTogether',o.games,'wins',o.wins,'losses',o.losses,'lastGame',o.last_game,'relationship',public.career_relation(me,o.user_id))),'[]') into data from (
       select opponent_id as user_id,games,wins,losses,last_game from public.career_opponents
       where user_id=me and not public.career_blocked(me,opponent_id) order by games desc,opponent_id limit 10
     ) o;
     result:=result || jsonb_build_object('opponents',data);
   end if;
   return result;
 end if;
 raise exception 'Unknown career operation';
end; $$;
-- Helper functions are private; only the bounded gateway and trusted ingest are exposed.
revoke all on function public.assign_player_username(),public.career_blocked(uuid,uuid),public.career_relation(uuid,uuid),public.career_player(uuid,uuid),public.career_award(uuid,uuid,integer,text),public.career_report(uuid,uuid) from public,anon,authenticated;
revoke all on function public.career_api(text,jsonb) from public;
grant execute on function public.career_api(text,jsonb) to authenticated,anon;
notify pgrst, 'reload schema';
commit;
