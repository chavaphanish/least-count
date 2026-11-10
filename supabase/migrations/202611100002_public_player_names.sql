-- Apply after 202611100001_signup_identity.sql. Public names only; no data rewrites.
begin;
create or replace function public.public_player_identities(player_ids uuid[])
returns table(id uuid, username text, first_name text, last_name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(cardinality(player_ids),0)>100 then raise exception 'Request at most 100 players'; end if;
 return query
 select p.id,p.username,p.first_name,p.last_name
 from public.profiles p join auth.users u on u.id=p.id
 where p.id=any(player_ids) and u.email_confirmed_at is not null
   and not coalesce(u.is_anonymous,false);
end $$;
revoke all on function public.public_player_identities(uuid[]) from public;
grant execute on function public.public_player_identities(uuid[]) to anon,authenticated;
-- Profile RLS and write permissions remain unchanged. No email/auth metadata is projected.
notify pgrst, 'reload schema';
commit;
