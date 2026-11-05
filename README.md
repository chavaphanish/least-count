# Least Count

Least Count is a responsive browser card game with a green felt table, local practice, and server-authoritative online rooms for 2–8 players.

**This branch adds onboarding and multiplayer.** Guest rooms work without external authentication configuration. Google sign-in, verified email/password accounts, password recovery, and profile pictures require a Supabase project: follow [the step-by-step setup guide](docs/supabase-setup.md). These provider-dependent flows are tested with mocks here, not a live Supabase project. Review this feature in its pull request before merging or deploying.

## Playing

- Continue as Guest with a display name, or sign in after Supabase is configured. Sessions restore on refresh.
- From the dashboard, create a room or join using a six-character code or invitation link.
- Room defaults are four players, a 100-point cumulative elimination cutoff, and 60-second turns. The host can choose 2–8 players, any positive safe-integer cutoff, or untimed play.
- Share the invitation link. It uses the current site's origin and preserves the room through sign-in.
- The waiting lobby updates live. **Only the host can start**, manually, when every reserved seat is connected and the room is exactly full. Starting is atomic and deals seven cards per player.
- The online table uses the existing engine. Select cards, choose a legal draw source, call Show, handle 7 penalties, and play subsequent rounds. The server validates actions and sends each player only their own hand.
- **Play Game** remains available for offline local practice against 1–7 simulated opponents, including the existing parallel discard/pickup animation, reduced-motion support, saved progress, and rule downloads.

### Sessions, presence, and leaving

Guests receive a cryptographically random session in an HttpOnly, SameSite cookie (Secure on HTTPS). Only its hash is stored on the server. Guest sessions expire after seven days; the same browser and cookies restore the same identity. Signing out invalidates that guest session and leaves the current room. Guests have no email, password, or editable registered profile.

Each identity may belong to one room at a time. Refreshing reconnects the existing seat. Live sockets heartbeat every 20 seconds; after 45 seconds without a heartbeat, a connection is considered offline. Waiting-lobby seats are retained for a further 90 seconds before removal. Explicitly leaving frees a waiting seat immediately. Host ownership transfers deterministically to the earliest connected remaining participant, then earliest remaining participant if nobody is connected. Empty waiting rooms close.

An active game's disconnected seats remain part of the match; disconnecting does not introduce a new forfeit rule or pause timed turns. The server's 60-second deadline still applies. Untimed games have no turn alarm or automatic timeout elimination: a disconnected current player must reconnect to continue. No automatic bot replacement or midgame seat replacement is implemented. Closing a room is available to its host only before the game starts.

Local practice is stored in this tab's `sessionStorage`; other hands are only visually concealed in this offline mode. Online state is persisted in Cloudflare Durable Objects, with private hand projections sent over authenticated WebSockets. Refreshing never resets the server deadline.

## Rulebook and confirmed decisions

Read these documents together:

1. [Rulebook — Edition 2.0 (Working Draft)](RULEBOOK.md): the original uploaded document, preserved unchanged.
2. [Confirmed rule decisions](docs/rule-clarifications.md): the user's clarifications, which **take precedence over conflicting text in the original draft**.

The initial clarification topics have been answered. The overall rulebook remains provisional and can be refined in later stages; newly discovered ambiguities should be clarified before implementing affected behavior.

### Gameplay reference

The shared engine follows these rules; the linked documents give the full details:

- **Players and dealing:** 2–8 players, seven starting cards each; one standard deck plus one Printed Joker for 2–4 players, or two decks plus two Printed Jokers for 5–8 players.
- **Selected Joker:** choose a new eligible indicator each round, excluding 7s and Printed Jokers. Remove that physical card from play; the remaining cards of its rank are worth zero.
- **Normal turns:** discard one card or a same-rank group, then draw one replacement unless the discard matches the previously visible top rank. That Match and Drop action requires no draw.
- **Open pickup:** a required replacement draw may come from the immediately preceding player's latest eligible discard group or the draw pile. Older groups are unavailable. Accepting a 7 penalty or timing out clears eligibility, so the next required replacement draw must come from the draw pile. Match and Drop still requires no draw.
- **Power card 7:** starts a two-card penalty, with two more cards per responding 7 action. Multiple 7s in one action still add only two. A full uninterrupted cycle through all active players cancels the penalty.
- **Show:** available at the start of a normal turn with a hand total of five or less. An empty-handed player must call Show at their next normal turn; passing is not allowed. Show cannot be called during a 7 penalty.
- **Zero-point Show ties:** all zero-point players, including the caller, are tied round winners and receive zero round penalties. The caller does not receive the 40-point failed-Show penalty for a zero-point tie. This exception does not extend to positive-point ties.
- **Elimination and winning:** the default cumulative cutoff is 100 points; reaching or exceeding it eliminates a player. Turns have a 60-second limit, with immediate elimination on timeout. There are no special tiebreaker rounds. Ordinary rounds retain cumulative scores until elimination leaves one match winner.

For example, if the final two players each have 99 cumulative points and tie on a zero-point Show, both remain at 99 and play another ordinary round. A tied round result is not a shared match victory.

The linked documents contain the detailed scoring, hand-privacy, penalty, and draw-pile exhaustion rules. Online rooms enforce hand privacy and deadlines on the server. Room hosts may choose a positive custom elimination cutoff or disable turn deadlines; other rules are unchanged.

## Development

Use Node.js 24 (see `.nvmrc`) and npm. Node.js 22.12+ within 22.x is also supported.

```sh
npm ci
npm run build
```

Run these in **two terminals**, from the repository root:

```sh
# Terminal 1: local Worker, persistent rooms, and WebSockets
npm run dev:server
```

```sh
# Terminal 2: frontend (open the printed http://127.0.0.1:5173 address)
npm run dev -- --host 127.0.0.1
```

Vite proxies `/api` and WebSockets to the Worker at port 8787. Use the `127.0.0.1` address to match the local origin allowlist. Local Wrangler state is stored under ignored `.wrangler/`; deleting it removes local sessions and rooms. No Supabase variables are needed for guests or local practice. To enable registered accounts locally, create the ignored `.dev.vars` using `.dev.vars.example` and the setup guide. Do not commit credentials.

For a different development host/port, set `APP_ORIGIN` explicitly on the Worker command to that frontend origin. Serving `dist` alone supports local practice but cannot provide online rooms or authentication.

| Command | Purpose |
|---|---|
| `npm run dev` | Vite frontend with hot reload and API proxy |
| `npm run dev:server` | Local Worker and Durable Objects |
| `npm run typecheck` | Strict TypeScript checks for frontend, Worker, and browser tests |
| `npm run build` | Type-check and build frontend into `dist/` |
| `npm run preview` | Preview built frontend, with the same local API proxy |
| `npm test` | Run unit tests once, noninteractively |
| `npm run test:watch` | Interactive unit tests |
| `npm run test:e2e` | Browser checks; starts the Worker and Vite automatically |

There is no separate lint command configured. Browser setup:

```sh
npx playwright install chromium
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium` if system libraries are missing. A system Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. After building, `PLAYWRIGHT_PREVIEW=1 npm run test:e2e` tests production assets against the local Worker. Artifacts are ignored.

Tests cover the existing game rules and local UI, session initialization, provider verification with mocked Supabase, profile ownership, avatar file validation, room settings/membership, private projections, host transfer, atomic starts, server deadlines, and real guest multi-browser rooms. Live Google consent, actual verification/reset email delivery, and real Supabase Storage/RLS checks remain deployment checks in [the setup guide](docs/supabase-setup.md).

## Architecture and files

```text
src/game/                 Framework-independent decks, immutable engine, bots, tests
src/shared/multiplayer.ts Validated room settings and public wire types
src/auth/                 Supabase client, startup stages, session provider, tests
src/components/           Shared cards, avatars, loading screen, layout
src/pages/                Access, dashboard, profile, lobby/online table, local game, rules
src/hooks/                Local practice and authenticated realtime room connections
src/lib/                  Local saved-session validation
server/index.ts           Same-origin Worker API and assets routing
server/auth.ts            Provider-verified identity and own-profile/avatar operations
server/objects.ts         Durable session/code directory and persisted realtime rooms
server/room.ts            Testable authoritative room/game transitions and projections
server/http.ts            Origin checks, bounded bodies, cookies, cryptographic tokens
supabase/migrations/      Profiles, avatar bucket, owner-only RLS policies
wrangler.jsonc            Worker/assets, SQLite Durable Object bindings and migration
.dev.vars.example         Public provider configuration placeholders
```

Registered sessions use Supabase PKCE, persisted SDK sessions and automatic token refresh. The Worker verifies every bearer token using Supabase `getUser`, requires a verified email, and accesses profiles/Storage with the caller's JWT and public publishable key. No service-role key is used. Profile UUIDs come from verified identity. Emails and account timestamps are returned only by the private self-session endpoint; room projections contain only public names/avatars, presence, scores, and visible cards.

A single directory object reserves collision-checked six-character codes and tracks identity membership. Each room has its own Durable Object, serializing join/start/action operations and persisting state. Short-lived, single-use connection tickets keep long-lived credentials out of WebSocket URLs. Socket authorization expires with the originating session; reconnect obtains a fresh verified ticket. Requests enforce same-origin mutation checks and bounded payloads. The server supplies actor IDs and securely randomized dealing; clients cannot start for another host or submit another player's turn. Request IDs prevent replaying accepted socket actions. Alarms enforce timed turns independently of browser clocks.

The shared engine accepts validated room settings when the host starts. It retains the default cutoff/timer for old local saves. Untimed turns have a null deadline; scoring uses the configured cutoff. Other rule behavior and the original rulebook are preserved.

Avatar uploads accept JPG/PNG/WebP up to 2 MB, validate signatures on both sides, and use server-generated paths in the owner's folder. The browser also decodes images and limits dimensions to 4096 × 4096. Storage policies enforce ownership. Profile images are public; email is not. Replacing/removing an avatar cleans up its old object. There is no match-history database or mobile packaging.

## Cloudflare deployment

Online features now require the **Worker plus Durable Objects**, rather than a static-only Pages deployment. The existing Worker name remains `least-count`. `wrangler.jsonc` bundles the API and `dist` assets, SPA fallback for `/join/CODE` and `/auth/callback`, and the initial SQLite Durable Object migration.

For the existing Git-connected Cloudflare Worker, after PR review:

| Setting | Value |
|---|---|
| Root | Repository root |
| Build | `npm run build` |
| Deploy | `npx wrangler deploy` |
| Preview deploy | `npx wrangler versions upload` |
| Node | `NODE_VERSION=24` |

Use the configuration-driven deploy command so the API, bindings, and migrations accompany the assets. Keep the `v1` migration once deployed; future schema/class changes need new tags. Review Cloudflare's current plan/usage limits for SQLite Durable Objects. No deployment is performed by the build or tests. Worker preview URLs have isolated origins: registered callbacks require explicit Supabase allowlisting; use a stable reviewed testing domain for provider checks.

| Runtime variable | Purpose |
|---|---|
| `SUPABASE_URL` | Project HTTPS URL; omit with the key for guest-only mode |
| `SUPABASE_PUBLISHABLE_KEY` | Public publishable key (or legacy anon key); deliberately exposed to the SDK |
| `APP_ORIGIN` | Optional comma-separated additional exact frontend origins; same-origin production works without it |

Set runtime variables using Cloudflare configuration for both deployment and previews as needed; if Git deploys replace dashboard variables, use Wrangler's documented `--keep-vars` deployment option. Never supply a service-role key, database password, Google client secret, or SMTP password to the frontend or these public variables. Google and SMTP credentials belong only in Supabase/provider dashboards.

## Next steps

1. Review this PR and follow [Supabase setup and live checks](docs/supabase-setup.md).
2. Deploy a reviewed build and test Google/email/profile storage against the real project.
3. Playtest registered/guest mixed rooms and reconnection on real mobile networks. Record new rule decisions before changing gameplay.

Substantial changes use pull requests; this feature must not merge automatically. Small trivial updates may go directly to `main` when authorized.
