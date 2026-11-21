# YAYDU architecture

Developer reference verified against repository sources. [AGENTS.md](AGENTS.md) defines workflow; [GAME_RULES.md](GAME_RULES.md) and [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) cover specialized behavior. Operational guides in `docs/` remain useful; historical prose and backlog entries are not authoritative feature inventories.

## Stack and build

- React 19 + TypeScript, Vite 7, npm; Node 24 via `.nvmrc` (package engine also allows 22.12+ within 22.x). See [package scripts](package.json).
- Cloudflare Worker with SQLite-backed Durable Objects and bundled Vite assets: [wrangler.jsonc](wrangler.jsonc). Repository, Worker and internal service names remain `least-count`; visible brand is YAYDU.
- Supabase Auth, PostgreSQL/RPC and Storage; `@supabase/supabase-js` is used in browser and server with different privilege boundaries.
- Capacitor 8.6.0 wraps `dist/` for native iOS/Android. [capacitor.config.ts](capacitor.config.ts) accepts `CAPACITOR_APP_ID`, default `com.example.leastcount`; this is a development placeholder, not a finalized store ID.
- Vitest runs Node tests; some SQL tests use embedded PostgreSQL via PGlite. Playwright runs browser tests with local Worker/Vite servers and explicit provider mocks where needed.

## Source map and ownership

| Area | Responsibility |
| --- | --- |
| [src/main.tsx](src/main.tsx), [src/App.tsx](src/App.tsx) | Providers, styles, hash-route selection, public/authenticated access and loading composition |
| [src/auth/AuthProvider.tsx](src/auth/AuthProvider.tsx), [services.ts](src/auth/services.ts) | Session restoration, Supabase SDK lifecycle, authenticated API transport |
| [src/game/engine.ts](src/game/engine.ts), [deck.ts](src/game/deck.ts), [events.ts](src/game/events.ts) | Shared immutable card state, values, rules, structured public events |
| [src/hooks/useLocalGame.ts](src/hooks/useLocalGame.ts), [src/lib/session.ts](src/lib/session.ts) | Local human/bot play and saved-session validation/restoration |
| [src/hooks/useRoom.ts](src/hooks/useRoom.ts), [src/pages/RoomPage.tsx](src/pages/RoomPage.tsx) | Room snapshots, socket lifecycle, pending requests and online table |
| [src/components/](src/components/), [src/presentation/handLayout.ts](src/presentation/handLayout.ts) | Shared identity/cards/actions/overlays and adaptive geometry |
| [src/career/](src/career/), [src/presence/](src/presence/), [src/feedback/](src/feedback/) | Careers/social UI, shared online status, sound/haptic preferences |
| [server/index.ts](server/index.ts), [http.ts](server/http.ts), [types.ts](server/types.ts) | Same-origin API/assets router, boundary validation/errors and Worker bindings |
| [server/objects.ts](server/objects.ts), [room.ts](server/room.ts) | Durable storage/serialization/socket transport versus testable room transitions/projections |
| [server/auth.ts](server/auth.ts), [access.ts](server/access.ts), [identity.ts](server/identity.ts) | Provider verification, registration/login validation, own profile operations |
| [server/career.ts](server/career.ts), [career-api.ts](server/career-api.ts), [circle.ts](server/circle.ts) | Accepted game telemetry/ingestion, authorized profile/rank/social operations |
| [server/presence.ts](server/presence.ts) | Authenticated multi-session heartbeat storage in Directory |
| [server/account-deletion.ts](server/account-deletion.ts), [erasure.ts](server/erasure.ts) | Confirmed account deletion, durable room cleanup and history anonymization |
| [supabase/migrations/](supabase/migrations/) | Ordered profile, career, identity/access, avatar and erasure schema/RPC/policy changes |
| [build/pwa.ts](build/pwa.ts), [src/pwa/](src/pwa/) | Production service-worker generation and controlled update UI |

`DashboardPage` remains the internal Lounge component. Do not rename files, APIs, database objects or storage keys just to align display wording.

## Data flows

### Sessions and registration

1. Browser requests `/api/config` and restores `/api/session` through `Services`/`AuthProvider`.
2. Guest creation uses `/api/guest` and a cryptographically random HttpOnly SameSite cookie backed by Directory. Registered access uses a Supabase bearer token, verified server-side by `getUser` and confirmed-email checks.
3. The current three signup steps are **first/last names**, then **username/email**, then **password/confirmation**. Shared validation is in [src/shared/identity.ts](src/shared/identity.ts). The SDK retains PKCE/session/refresh ownership; its signup transport is routed through `/api/auth/register` for final server validation. Login/availability use `/api/auth/login` and `/api/auth/availability`.
4. Caller-JWT profile/avatar requests enforce ownership. Privileged identity availability/login lookup uses narrowly granted RPCs through the server-only career credential. Recovery/callback behavior stays with existing provider flows.
5. Public identity is first/last names plus `@username` with legacy fallback; emails and credentials are not public identity fields. [Player identity formatting](src/shared/playerIdentity.ts) is shared.

Unauthenticated users cannot enter local gameplay; a guest or registered session is required. Guest online rooms are disabled by the baked default and can be enabled with `GUEST_MULTIPLAYER_ENABLED=true`; local development sets that override. Do not confuse test/dev configuration with production.

### Authoritative rooms and sockets

1. Authenticated `/api/rooms` creation goes through Directory, which reserves a collision-checked six-character code and membership. Joining uses the room-code routes in `server/index.ts`.
2. A `GameRoom` object owns each persisted room. `server/room.ts` validates membership, full connected seats and host start, using secure server randomness.
3. A short-lived single-use ticket authorizes the WebSocket; long-lived bearer credentials are not put in its URL. The socket actor comes from verified identity.
4. `useRoom` sends an action with a UUID request ID. The object serializes handling, checks its bounded retained actor/request-ID deduplication list, applies the shared engine, persists and broadcasts per-player projections. Do not assume unbounded replay protection beyond retained IDs.
5. Public snapshots carry revision, `serverNow`, deadline, own hand, other card counts/scores, eligible public cards and events. `view()` is an allowlist, not serialization of `RoomRecord`. Some room membership timing fields are currently public; tokens/emails and hidden card state must stay private.
6. Alarms/sweeps enforce timed forfeits, waiting-seat grace, host transfer and persistence/retries. Client reconnect obtains a new snapshot/ticket; it does not reset time or replay offline actions automatically.

Waiting-room reservations have a 90-second grace; room heartbeat freshness is 45 seconds. Registered online-presence dots use a separate 30-second heartbeat/60-second TTL, with multiple session support; do not merge those semantics. Host-transfer selection has a 30-second deadline. See [GAME_RULES.md](GAME_RULES.md) for score/forfeit behavior.

### Careers, social features and deletion

- `server/career.ts` observes accepted transitions. Durable pending revisions are retried into transactional Supabase ingestion with an XP ledger; clients do not award their own XP. [src/career/model.ts](src/career/model.ts) supplies `xpProgress()` to UI consumers.
- Default rewards: qualifying completed round 10 XP, finalized-game participation 25, victory bonus 75; configuration/eligibility/caps are described in [player-careers.md](docs/player-careers.md). The level threshold is `levelBase × (level − 1) × level`, base 50 by default.
- Profiles, matches, participant aggregates, frequent opponents, XP transactions, buddy requests/relationships and blocks live in Supabase. `server/circle.ts` uses accepted relationships/statistics for searches and favourites, rather than inventing client-owned favourites.
- Presence is transient Directory state, not proof of a stored login or a new per-avatar API timer. [Avatar](src/components/Avatar.tsx) consumes the shared presence provider.
- Account deletion requires authenticated identity, password re-verification and explicit confirmation. Cleanup is a durable multi-stage job covering retained GameRoom objects, avatars, history anonymization and Auth deletion. It is production-origin gated. Do not replace it with direct deletion from auth tables. See [account-deletion.md](docs/account-deletion.md).

## Security and configuration boundaries

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are public configuration. Caller-authorized operations use the verified caller JWT/RLS.
- `SUPABASE_CAREER_KEY` is **server-only**: privileged ingestion and access-validation operations. `SUPABASE_ACCOUNT_ADMIN_KEY` optionally overrides it for Auth Admin deletion. `ACCOUNT_DELETION_CF_TOKEN` is a server-only read token for retained-object discovery; actual cleanup uses private bindings. Never reproduce values in docs or browser variables.
- `CAREER_ENABLED`, `CAREER_ORIGIN`, `APP_ORIGIN` and deletion metadata control capability/origin boundaries; read [server/types.ts](server/types.ts) and each operational guide before changing them.
- Maintain body limits, origin checks, authorization and RLS/function grants. SQL tests emulate provider roles; they cannot verify live Supabase settings or deployed secrets.
- Deployment uses `keep_vars: true`; preserve production secrets and Durable Object migration history. See [Supabase setup](docs/supabase-setup.md), [identity rollout](docs/signup-identity.md), [access rollout](docs/access-validation.md), and [careers](docs/player-careers.md).

## Mobile, native and deployment boundaries

`MobileOrientation` owns detection, portrait guard and the shared measured viewport (dimensions and origin); safe-area/layout CSS consumes its variables. [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) details the files. Rotation keeps controllers mounted, so it must not reset auth, hands, sockets or deadlines. **The physical iPhone first-rotation Lounge-height bug is still open:** [#63](https://github.com/chavaphanish/least-count/issues/63). The prior simulations do not prove a hardware fix.

The manifest requests standalone landscape. [src/pwa/service-worker.js](src/pwa/service-worker.js) uses network navigation and controlled activation rather than offline game caching; API/auth/socket traffic is not an offline queue. Native compilation/signing and backend-origin integration remain separate from web builds and Capacitor sync.

`npm run build` type-checks and emits `dist/`; it does not deploy. Vite development/preview proxies API/WebSocket traffic to Wrangler at 8787. Cloudflare builds production with `npm run build` and deploys via `npx wrangler deploy`; `versions upload` cannot apply pending Durable Object migrations and an uploaded version alone does not prove active production traffic. Keep names/bindings/configuration unchanged for documentation work.

## Documentation discrepancies and unfinished work

- The archived root rulebook still includes old branding/rules (including timeout elimination); current amendments and `GAME_RULES.md` identify implemented behavior. Preserve the original rather than rewriting its history.
- Some README sections and [TODOS.md](TODOS.md) predate implemented access, presence, navigation and security features. For example, “No service-role key is used” applies only to ordinary caller-authorized profile access, not privileged server operations. Do not infer absence or security guarantees from those old statements.
- Native marketing/build versions remain separate placeholders (`1.0`/`1`); web releases derive from package metadata. No automatic native version-sync script is configured.
- Tutorial and Mailbox are placeholders; backlog items such as rematches/automatic round advance are not verified implementations.
- Some older browser tests target superseded signup steps/navigation selectors. Report such failures, verify the relevant current behavior, and do not claim the entire suite passes without running it.
- No lint script or repository GitHub Actions workflow is present at review time. Cloudflare build checks do not imply all unit/browser/provider tests ran. Live provider configuration, actual email delivery, physical PWA behavior and store readiness require separate verification.
