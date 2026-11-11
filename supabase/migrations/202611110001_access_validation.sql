-- Apply after the identity/public-name migrations, as one transaction.
-- No user/profile rows are rewritten, no existing constraints are tightened.
begin;
create or replace function public.check_signup_identity(handle text, given_name text, family_name text)
returns void language plpgsql immutable set search_path='' as $$
begin
 if handle is null or handle !~ '^[A-Za-z0-9]{8,20}$' then raise exception 'Username must contain 8–20 letters and numbers'; end if;
 if given_name is null or btrim(given_name) !~ '^[A-Za-z]{1,80}$' then raise exception 'First Name may contain only English letters'; end if;
 if family_name is null or btrim(family_name) !~ '^[A-Za-z]{1,80}$' then raise exception 'Last Name may contain only English letters'; end if;
end $$;
revoke all on function public.check_signup_identity(text,text,text) from public,anon,authenticated;

create or replace function public.create_signup_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare handle text:=new.raw_user_meta_data->>'username'; given_name text:=new.raw_user_meta_data->>'first_name'; family_name text:=new.raw_user_meta_data->>'last_name';
begin
 if coalesce(new.is_anonymous,false) then return new; end if;
 perform public.check_signup_identity(handle,given_name,family_name);
 if new.email is null or char_length(new.email)>254 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid email address is required'; end if;
 -- Provider uniqueness remains in force. Serialize our additional case-insensitive
 -- guard too, including direct provider signups that bypass the Worker preflight.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signup-email:'||lower(btrim(new.email)),0));
 if exists(select 1 from auth.users u where lower(btrim(u.email))=lower(btrim(new.email)) and u.id<>new.id and not coalesce(u.is_anonymous,false)) then
  raise unique_violation using message='This email address is already registered';
 end if;
 insert into public.profiles(id,display_name,username,first_name,last_name,needs_profile_completion)
 values(new.id,lower(handle),lower(handle),btrim(given_name),btrim(family_name),false);
 return new;
end $$;
revoke all on function public.create_signup_identity() from public,anon,authenticated;

-- Only the Worker service-role client may resolve identifiers or inspect email availability.
-- Never grant these RPCs to anon/authenticated, or return their private results to the browser.
create or replace function public.resolve_login_email(candidate text) returns text
language sql stable security definer set search_path='' as $$
 select u.email from public.profiles p join auth.users u on u.id=p.id
 where lower(p.username)=lower(candidate) and not coalesce(u.is_anonymous,false) limit 1
$$;
revoke all on function public.resolve_login_email(text) from public,anon,authenticated;
grant execute on function public.resolve_login_email(text) to service_role;
create or replace function public.signup_availability(candidate text, address text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if candidate is null or candidate !~ '^[A-Za-z0-9]{8,20}$' or address is null or char_length(address)>254 then raise exception 'Invalid account information'; end if;
 return jsonb_build_object(
  'usernameAvailable',not exists(select 1 from public.profiles where lower(username)=lower(candidate)),
  'emailAvailable',not exists(select 1 from auth.users where lower(btrim(email))=lower(btrim(address)) and not coalesce(is_anonymous,false))
 );
end $$;
revoke all on function public.signup_availability(text,text) from public,anon,authenticated;
grant execute on function public.signup_availability(text,text) to service_role;
notify pgrst,'reload schema';
commit;
