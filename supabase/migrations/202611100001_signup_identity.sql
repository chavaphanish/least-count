-- Apply after 202611060002_careers.sql. Transactional, forward-only; no account/data deletion.
begin;
lock table auth.users, public.profiles in share row exclusive mode;
alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists last_name text not null default '';
alter table public.profiles add column if not exists needs_profile_completion boolean not null default true;

-- Plan usernames before changing anything. Reuse unique valid legacy display names first.
create temporary table identity_username_plan(id uuid primary key, username text not null) on commit drop;
create unique index on identity_username_plan(lower(username));
insert into identity_username_plan
select id, lower(display_name) from public.profiles p
where display_name ~ '^[A-Za-z0-9]{8,24}$'
  and (select count(*) from public.profiles p2 where lower(p2.display_name)=lower(p.display_name))=1;
do $$
declare p record; candidate text; attempt integer;
begin
 for p in select id from public.profiles where id not in(select id from identity_username_plan) order by id loop
  attempt:=0;
  loop
   candidate:='player'||substr(md5(p.id::text||':'||attempt::text),1,18);
   exit when not exists(select 1 from identity_username_plan where lower(username)=candidate);
   attempt:=attempt+1;
  end loop;
  insert into identity_username_plan values(p.id,candidate);
 end loop;
end $$;
-- Remove only the redundant case-sensitive index; rows, IDs and foreign keys stay intact.
drop index if exists public.profiles_username_unique;
update public.profiles p set username=plan.username from identity_username_plan plan where p.id=plan.id;
create unique index profiles_username_case_insensitive_unique on public.profiles(lower(username));
alter table public.profiles add constraint profiles_username_format check(username ~ '^[a-z0-9]{8,24}$');
alter table public.profiles add constraint profiles_first_name_safe check(char_length(first_name)<=80 and first_name !~ '[[:cntrl:]]');
alter table public.profiles add constraint profiles_last_name_safe check(char_length(last_name)<=80 and last_name !~ '[[:cntrl:]]');

-- Retain RLS. Names are owner-only profile fields, never public career fields.
create or replace view public.career_public_profiles as
 select p.id,p.username as display_name,p.avatar_path,p.created_at,p.last_active_at,p.username
 from public.profiles p join auth.users u on u.id=p.id
 where u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
revoke all on public.career_public_profiles from public,anon,authenticated;

create function public.check_identity(identity_username text, given_name text, family_name text)
returns void language plpgsql immutable set search_path='' as $$
begin
 if identity_username is null or identity_username !~ '^[A-Za-z0-9]{8,24}$' then raise exception 'Use 8–24 letters and numbers for your username'; end if;
 if given_name is null or family_name is null or char_length(btrim(given_name)) not between 1 and 80 or char_length(btrim(family_name)) not between 1 and 80 or given_name ~ '[[:cntrl:]]' or family_name ~ '[[:cntrl:]]' then raise exception 'First and last name are required (1–80 characters each)'; end if;
end $$;
revoke all on function public.check_identity(text,text,text) from public,anon,authenticated;

-- This boolean exposes public username availability only: no email/name/ID/account lookup.
create function public.player_username_available(candidate text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if candidate is null or candidate !~ '^[A-Za-z0-9]{8,24}$' then raise exception 'Invalid username'; end if;
 return not exists(select 1 from public.profiles where lower(username)=lower(candidate) and id is distinct from auth.uid());
end $$;
revoke all on function public.player_username_available(text) from public;
grant execute on function public.player_username_available(text) to anon,authenticated;

drop trigger if exists assign_player_username on public.profiles;
-- Enforce identity and reserve the username in the SAME transaction as auth account creation.
-- Concurrent signups cannot both claim a name; a losing auth insert rolls back completely.
create function public.create_signup_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare handle text; given_name text; family_name text;
begin
 if coalesce(new.is_anonymous,false) then return new; end if;
 handle:=new.raw_user_meta_data->>'username'; given_name:=new.raw_user_meta_data->>'first_name'; family_name:=new.raw_user_meta_data->>'last_name';
 perform public.check_identity(handle,given_name,family_name);
 insert into public.profiles(id,display_name,username,first_name,last_name,needs_profile_completion)
 values(new.id,lower(handle),lower(handle),btrim(given_name),btrim(family_name),false);
 return new;
end $$;
revoke all on function public.create_signup_identity() from public,anon,authenticated;
create trigger create_signup_identity after insert on auth.users for each row execute function public.create_signup_identity();

-- Keep the existing login RPC signature, including legacy users without a profile yet.
create or replace function public.ensure_player_profile(proposed_display_name text)
returns setof public.profiles language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); candidate text; attempt integer:=0;
begin
 if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required'; end if;
 if not exists(select 1 from public.profiles where id=me) then
  loop
   candidate:='player'||substr(md5(me::text||':'||attempt::text),1,18);
   begin
    insert into public.profiles(id,display_name,username)
    values(me,case when char_length(btrim(proposed_display_name)) between 2 and 24 then btrim(proposed_display_name) else 'Player' end,candidate)
    on conflict(id) do nothing;
    exit;
   exception when unique_violation then attempt:=attempt+1;
   end;
  end loop;
 end if;
 update public.profiles set last_active_at=now() where id=me;
 return query select * from public.profiles where id=me;
end $$;
revoke all on function public.ensure_player_profile(text) from public,anon;
grant execute on function public.ensure_player_profile(text) to authenticated;

create function public.update_player_identity(identity_username text, given_name text, family_name text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required'; end if;
 perform public.check_identity(identity_username,given_name,family_name);
 update public.profiles set username=lower(identity_username), first_name=btrim(given_name), last_name=btrim(family_name), needs_profile_completion=false where id=auth.uid();
 if not found then raise exception 'Profile unavailable'; end if;
end $$;
revoke all on function public.update_player_identity(text,text,text) from public,anon;
grant execute on function public.update_player_identity(text,text,text) to authenticated;
revoke insert,update on public.profiles from authenticated;
grant update(display_name,avatar_path,last_active_at) on public.profiles to authenticated;
commit;
