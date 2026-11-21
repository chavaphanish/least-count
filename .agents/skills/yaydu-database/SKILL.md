---
name: yaydu-database
description: Use for YAYDU Supabase SQL/RLS/RPC migrations, authentication or identity/profile changes, avatars, friendships, career statistics/XP/rankings, account deletion, or data-integrity investigations.
---

# YAYDU database and identity workflow

Read database/security flows in [ARCHITECTURE.md](../../../ARCHITECTURE.md), then only relevant guides: [Supabase setup](../../../docs/supabase-setup.md), [identity](../../../docs/signup-identity.md), [access validation](../../../docs/access-validation.md), [careers](../../../docs/player-careers.md), [account deletion](../../../docs/account-deletion.md).

1. Trace the caller's [auth](../../../server/auth.ts), [access](../../../server/access.ts), [identity](../../../server/identity.ts), [career API](../../../server/career-api.ts) or [deletion](../../../server/account-deletion.ts) path and the applicable [ordered migrations](../../../supabase/migrations/). Identify public, owner-only and service-role operations explicitly.
2. Preserve stable account UUIDs, existing identities, XP ledger, history and friendship dependencies. Never seed/delete/reset production data or execute destructive operations without explicit authorization. Do not repair auth by inserting ad hoc auth-table rows.
3. Prefer an additive/reversible new migration over modifying deployed history. Inspect constraints/triggers, RLS, grants, `SECURITY DEFINER` and explicit search paths; avoid exposing emails or privileged lookup functions to anonymous clients.
4. Keep public publishable configuration separate from server-only career/admin/Cloudflare credentials. No secrets in Git, fixtures, chat, public responses or `VITE_*`. Preserve the authenticated deletion confirmation/password/origin checks and durable cleanup workflow.
5. Use the relevant PGlite-backed identity/career/account-erasure SQL tests and Worker authorization tests described in [testing skill](../yaydu-testing/SKILL.md). Verify unauthorized roles as well as owner/service behavior and repeat/idempotent operations.
6. For live rollout, follow the existing preservation/readiness queries and verify actual project settings separately. Never infer deployment from migration files or mocked success; report missing admin access without requesting secrets in chat.

Complete when schema/API contracts, security grants, data-preservation evidence, rollout prerequisites and test limits are documented. A migration draft is not a live migration; do not claim production data checks that were not performed.
