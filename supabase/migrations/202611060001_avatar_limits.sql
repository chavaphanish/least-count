-- Apply after 202611050001_profiles.sql. Preserve existing objects and policies.
begin;
update storage.buckets set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'avatars';
-- The original migration's owner policies remain required. No public write policy.
commit;
