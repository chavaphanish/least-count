# Access form rollout

Apply [202611110001_access_validation.sql](../supabase/migrations/202611110001_access_validation.sql) **before merging/deploying this change**. Run the entire file, from `begin;` through `commit;`, in the Least Count project's Supabase SQL editor using the project owner connection. The public app key cannot apply SQL migrations. No secret values are needed in chat.

The migration replaces signup validation and adds two Worker-only RPCs. It does not rewrite user/profile records, tighten legacy profile constraints, change RLS, or touch XP, buddies or history. New registrations require English-only first/last names and 8–20 alphanumeric usernames. Existing 8–24-character usernames, international names, missing legacy profile fields and email sign-in remain compatible. Existing case-insensitive username uniqueness and Supabase email ownership/password verification remain in force; signup inserts reserve identity in the same auth transaction.

Keep the existing Supabase email-confirmation setting and minimum password length of 8. The Worker reuses its existing **runtime secret** `SUPABASE_CAREER_KEY` for the private resolver/availability RPCs; never expose this key through public config or browser code. No deployment variable, binding or API service needs renaming.

## Record preservation checks

Run and save this read-only result immediately before the migration, and run it again afterwards. With no concurrent account/game activity, all values should match.

```sql
select
 (select count(*) from auth.users) as accounts,
 (select md5(coalesce(string_agg(id::text,',' order by id),'')) from auth.users) as account_ids_checksum,
 (select count(*) from public.profiles) as profiles,
 (select coalesce(sum(xp),0) from public.career_totals) as total_xp,
 (select count(*) from public.career_matches) as matches,
 (select count(*) from public.buddy_relationships) as buddy_pairs;
```

After applying the complete migration, run this readiness query. All four columns should be `true`:

```sql
select
 to_regprocedure('public.check_signup_identity(text,text,text)') is not null
   and position('check_signup_identity' in pg_get_functiondef('public.create_signup_identity()'::regprocedure)) > 0 as signup_validation_ready,
 to_regprocedure('public.resolve_login_email(text)') is not null as username_login_ready,
 not has_function_privilege('anon','public.resolve_login_email(text)','EXECUTE')
   and not has_function_privilege('authenticated','public.resolve_login_email(text)','EXECUTE')
   and not has_function_privilege('anon','public.signup_availability(text,text)','EXECUTE')
   and not has_function_privilege('authenticated','public.signup_availability(text,text)','EXECUTE') as private_rpcs_restricted,
 has_function_privilege('service_role','public.resolve_login_email(text)','EXECUTE')
   and has_function_privilege('service_role','public.signup_availability(text,text)','EXECUTE')
   and to_regclass('public.profiles_username_case_insensitive_unique') is not null as server_role_ready;
```

Report the migration result and readiness values so the reviewed PR can be merged. If SQL fails, copy the first error; do not recreate accounts or reset any data. Until the migration is ready, new availability/signup requests deliberately fail closed. Existing email login and guest-session code retain their current provider/session mechanisms.

## Verification after deployment

Use an existing verified account to sign in once by email and once by username, including mixed case. Confirm that its profile, XP, history and buddies remain the same. Do not post passwords or session tokens. Verify the three signup steps, popup dismissal/reset behavior, and that the final action requests email verification. Step 3 continues using the Supabase browser SDK, preserving its PKCE verifier and session management; signup transport passes through the same-origin Worker for final validation. Native Supabase signup also encounters the database identity/uniqueness trigger, so skipping the app UI cannot create an invalid identity.

Public login errors remain generic. Username resolution returns no account email to unauthenticated callers. Availability returns booleans for the submitted username/email only, as required by registration UX. Same-origin checks and short-lived, hashed-IP quotas in the existing Directory namespace bound these unauthenticated endpoints; no credentials are stored in the limiter. Browser email login/recovery still go directly to Supabase. No new tables, backend services or runtime dependencies are introduced.
