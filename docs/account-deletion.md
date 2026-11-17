# Account deletion rollout (1.1.22)

Deploy only after the database migration and Worker runtime configuration below are ready. No existing accounts are deleted by installing this feature. Do not test deletion on an account you want to keep.

## 1. Supabase

Run the entire `supabase/migrations/202611170001_account_erasure.sql` file, from `begin;` to `commit;`, in the project's SQL editor, once. It defines service-only cleanup functions, enables RLS on the erasure marker table, blocks new avatar writes while deletion is pending, and makes shared history support anonymous deleted seats. Existing account IDs, XP, history and buddy records are preserved during installation.

Then run this **read-only** readiness query. All four columns must be `true`:

```sql
select
  to_regprocedure('public.prepare_account_erasure(uuid)') is not null
    and to_regprocedure('public.anonymize_account_history(uuid)') is not null as cleanup_functions,
  coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.account_erasure_markers')),false) as marker_rls,
  (select count(*)=2 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname in ('Active account avatar insert','Active account avatar update')) as avatar_guards,
  position('normalize_erased_players' in pg_get_functiondef('public.ingest_career_match(jsonb)'::regprocedure))>0 as anonymous_history;
```

## 2. Cloudflare Worker runtime settings

Use **Workers & Pages → least-count → Settings → Variables and Secrets / Runtime**, not the build-only environment variables.

- Keep `CAREER_ORIGIN` equal to `https://least-count.chavaphanish.workers.dev` (no trailing slash). Account deletion is restricted to that production origin.
- Keep the existing server-only `SUPABASE_CAREER_KEY` service-role credential. It must support Supabase Auth Admin hard deletion. Alternatively add a server-only **secret** named `SUPABASE_ACCOUNT_ADMIN_KEY` with a service-role credential for the same Supabase project; it overrides the career key for deletion.
- Add runtime variable `ACCOUNT_DELETION_CF_ACCOUNT_ID`: the Cloudflare account ID containing this Worker.
- In Cloudflare **My Profile → API Tokens → Create Token → Custom Token**, create a token with **Account → Workers Scripts → Read**, restricted to this account only. Add it as a runtime **secret** named `ACCOUNT_DELETION_CF_TOKEN`.
- Optional: `ACCOUNT_DELETION_WORKER_NAME` defaults to `least-count`. Do not set it unless the Worker is deliberately renamed.

The read-only Cloudflare token allows the backend to enumerate every retained `GameRoom` Durable Object, including old closed casual rooms that no longer appear in the room directory. Actual room cleanup runs through the existing private Durable Object binding. No account-write or deployment permission is needed for this token.

Never place either secret in Git, `wrangler.jsonc`, a `VITE_*` variable, or chat. `wrangler.jsonc` sets `keep_vars: true` so deployments preserve dashboard-managed runtime variables; Cloudflare also preserves runtime secrets. Keep these values in production; previews cannot initiate deletion on the production origin.

## 3. Behavior and verification

After deployment, verify the Settings Profile editor and the Delete Account confirmation dialog without confirming deletion. A real deletion test must use an intentionally disposable account.

The account owner must supply their current password and type `DELETE`. The API ignores client identity claims and uses the verified bearer account. Before deleting anything, the durable cleanup job checks every retained room. If the owner still has an active seat in an unfinished game, deletion is blocked and nothing is deleted; finish the game and retry. A permanently eliminated spectator can delete without changing the ongoing game's scores, cards, order or deadlines.

Once accepted, cleanup marks the account pending, prevents new room joins/avatar uploads, anonymizes retained room snapshots and shared match reports, removes all files under the account's avatar prefix through the Storage API, then hard-deletes the account through Supabase Auth Admin. Existing foreign-key cascades remove its profile, career totals, XP ledger, owned match participation, buddy requests/connections and blocks. Other players' shared results and statistics are retained. Anonymous seat aliases and a one-way hashed erasure marker prevent delayed match reports from restoring the deleted identity; they contain no names, email, avatar or raw user ID.

Cleanup is asynchronous and survives browser closure, token revocation and Worker restarts. Failed steps retry automatically; the UI never reports success until every step completes. The opaque HTTP-only status cookie expires after one day. No passwords, bearer tokens or service credentials are stored in the job. Successful completion clears the browser session and returns to the Lounge entry screen.

If deletion cannot start, check the migration, runtime secrets and Auth/Storage/Cloudflare API permissions. If cleanup is retrying, restore the unavailable service or credentials; do not manually delete storage rows or cancel a partially completed job. No production account has been deleted by the automated tests (all use mocks or an isolated local database).
