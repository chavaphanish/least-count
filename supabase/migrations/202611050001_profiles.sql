-- Apply once in the project's SQL editor. No service-role key is needed by the app.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24 and display_name = btrim(display_name)),
  avatar_path text check (avatar_path is null or avatar_path like id::text || '/%'),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
create policy "Own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Own profile insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- SECURITY INVOKER preserves RLS. Concurrent first logins never overwrite a name.
create or replace function public.ensure_player_profile(proposed_display_name text)
returns setof public.profiles language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.profiles (id, display_name) values (auth.uid(), proposed_display_name) on conflict (id) do nothing;
  update public.profiles set last_active_at = now() where id = auth.uid();
  return query select * from public.profiles where id = auth.uid();
end; $$;
revoke all on function public.ensure_player_profile(text) from public;
grant execute on function public.ensure_player_profile(text) to authenticated;
-- Avatars are public pictures, never private account data. Writes remain owner-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=2097152, allowed_mime_types=excluded.allowed_mime_types;
create policy "Own avatar insert" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Own avatar update" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Own avatar delete" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Own avatar metadata" on storage.objects for select to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
