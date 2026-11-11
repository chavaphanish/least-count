> Current form update: [access validation rollout](access-validation.md) adds the new Personal → Account → Password steps, private username login and registration uniqueness checks without rewriting existing account data. Apply the earlier migrations below first.

> Public identity update: after the signup migration, apply [`202611100002_public_player_names.sql`](../supabase/migrations/202611100002_public_player_names.sql) as one complete query. Names and @usernames are now public, including career/history identities; email and authentication remain private. This additive function changes no account IDs, profiles, XP, buddies or history. Missing legacy names fall back to usernames and can be completed in My Profile. The sections below describe the original signup rollout.

# Signup identity rollout

Apply `supabase/migrations/202611100001_signup_identity.sql` after the three earlier profile/avatar/career migrations. Use the **Supabase SQL editor** with the project owner connection. The app's public key cannot perform migrations. No service-role key belongs in the browser or chat.

## Before and after

Record these values before applying the SQL, and compare them afterward:

```sql
select
  (select count(*) from auth.users where not coalesce(is_anonymous,false)) as accounts,
  (select md5(string_agg(id::text,',' order by id)) from auth.users where not coalesce(is_anonymous,false)) as account_ids_checksum,
  (select count(*) from public.profiles) as profiles,
  (select coalesce(sum(xp),0) from public.career_totals) as total_xp,
  (select count(*) from public.career_matches) as matches,
  (select count(*) from public.buddy_relationships) as buddy_pairs;
```

Use **Run** with the SQL as written. If the editor offers **Run and enable RLS**, choose the option that leaves the query unchanged: permanent profile RLS is already enabled, and the planning table is temporary. An automatic RLS command added after commit can report `identity_username_plan does not exist` even though the migration committed. In that case, check the new profile column, case-insensitive index, signup trigger and existing profile RLS before rerunning anything; if all are present/enabled, continue with the after-migration checks.

Run the complete migration as one transaction. It briefly locks account/profile writes, adds private identity fields, backfills only usernames, and installs signup validation. It does not delete accounts, recreate IDs, alter password hashes, or change statistics, XP, buddies, history, avatars or existing personal names. The old case-sensitive username index and profile-insert trigger are replaced by the new constraints/transactional auth trigger; these are schema changes, not data deletions. RLS stays enabled. The temporary planning table is session-local and dropped at commit.

- Unique valid legacy display names become lowercase usernames.
- Other legacy records receive collision-free `player…` handles, 24 alphanumeric characters long.
- Existing display names remain stored; public profile projections now use usernames.
- Unknown personal names remain empty for legacy accounts. A completion prompt does **not** block sign-in or casual/online play.
- New accounts require a username and both personal names. Username reservation and auth-account insertion commit or roll back together, including concurrent case-insensitive conflicts.
- The authenticated identity-update RPC acts only on `auth.uid()`. Personal names remain in owner-only profiles and the private session response; room identities and career projections exclude them.

Verify the format and uniqueness after running:

```sql
select count(*) as profiles,
       count(distinct lower(username)) as distinct_usernames,
       count(*) filter (where username !~ '^[a-z0-9]{8,24}$') as invalid_usernames,
       count(*) filter (where needs_profile_completion) as legacy_completion_prompts
from public.profiles;
```

The first two counts should match, `invalid_usernames` must be zero, and legacy completion prompts are expected. The earlier account/XP/history/buddy counts must be unchanged. Confirm both existing users can sign in, see their original careers and photos, and complete their own profile without seeing another person's email or authentication data.

## Provider settings and deployment

Keep Supabase **email confirmation enabled** and existing redirect URLs. Set the Email provider's **minimum password length to 8** if it is lower. Supabase remains the authority for email uniqueness and password strength; the application does not expose an email-availability endpoint or add composition rules. Existing sign-in credentials are preserved.

Apply this migration when the reviewed application PR is ready, then deploy the application and refresh clients using signup. Old signup pages lack the required metadata and will be rejected after the trigger is installed. The new username endpoint fails closed if the migration is missing; existing login remains compatible with the old schema, but new registrations need the migration. Coordinate this brief rollout window instead of relaxing database validation.

Usernames are canonical lowercase, with `@` added only for display. Personal names are trimmed/NFC-normalized. Passwords are not trimmed and support spaces/passphrases; confirmation and independent visibility controls are local only. Successful/obfuscated existing-email responses show verification/sign-in/reset guidance, and provider failures remain retryable. Historical completed-match snapshots retain their original recorded labels; IDs, scores and history are not rewritten.

## Validation

Database tests execute the migration against fixtures with two existing profiles and seeded XP, history and buddy data. They check preservation, legacy login, existing name collisions, case-insensitive signup races, invalid metadata rollback, private-field access and owner-only completion. Provider behavior is mocked in browser tests; actual email delivery and live project settings still require the project owner's checks above.

Local validation: 84 focused unit/database tests and 18 focused browser checks passed, including keyboard-sized forms, legacy completion, and Android/desktop signup. The production build also runs strict TypeScript checks. No live accounts were changed by these tests.
