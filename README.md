# Least Count

Least Count is a responsive browser card game with a green felt table, local practice, and server-authoritative online rooms for 2–8 players.

**Accounts and multiplayer:** Guest rooms work without external authentication configuration. Verified email/password accounts, password recovery, and profile pictures require a Supabase project: follow [the step-by-step setup guide](docs/supabase-setup.md). These provider-dependent flows are tested with mocks here, not a live Supabase project. Gameplay changes are reviewed in pull requests before deployment.

## Player careers and social features

Registered profiles now include Overview, Statistics, Game History, and Buddies, with public profile discovery, XP/levels, frequent opponents, and Global/Buddies XP Rankings on the dashboard. Large avatar photos are previewed, center-cropped and compressed before upload (5 MB input limit).

**Production setup required before enabling career tracking:** apply the two new Supabase migrations, configure the Worker-only `SUPABASE_CAREER_KEY` secret, and configure `CAREER_ORIGIN` plus `CAREER_ENABLED=true` as Worker secret bindings for production. See [player careers: setup, definitions, privacy, and testing](docs/player-careers.md). Keep tracking disabled in previews/tests connected to production data. Existing guest play and local practice remain casual and do not earn permanent XP.

Career results come from accepted Worker game transitions, with durable retries and a transactional XP ledger. Defaults are +10 XP per completed round, +25 for a finalized game, and +75 for victory. Levels follow `50 × (level − 1) × level`. Finalized wins/losses, round participation, Least/Power Card metrics, card actions, server-recorded time, and score/timeout eliminations are tracked without exposing hidden cards. Detailed history and frequent opponents remain private; public rankings show XP, levels and win performance. These metagame features do not change the card rules.

## Playing

- Continue as Guest with a display name, or sign in after Supabase is configured. Sessions restore on refresh.
- From the dashboard, create a room or join using a six-character code or invitation link.
- Room defaults are four players, a 100-point cumulative elimination cutoff, and 60-second turns. The host can choose 2–8 players, any positive safe-integer cutoff, or untimed play.
- Share the invitation link. It uses the current site's origin and preserves the room through sign-in.
- The waiting lobby updates live. **Only the host can start**, manually, when every reserved seat is connected and the room is exactly full. Starting is atomic and deals seven cards per player.
- Each round opens with a visible card. For a non-7, the starter drops first, then picks up the eligible opening card or draws one closed replacement when required. Match and Drop and playing 7s skip that replacement. An opening 7 immediately activates a two-card penalty; an opener without a 7 draws automatically and skips.
- The online table uses the existing engine. Select cards, choose a legal draw source, declare Least, handle 7 penalties, and play subsequent rounds. The server validates actions and sends each player only their own hand.
- **Play Game** remains available for offline local practice against 1–7 simulated opponents, including the sequential drop-then-pickup animation, reduced-motion support, saved progress, and rule downloads.

### Guided gameplay controls

Local and online play share a context-aware action bar: select matching cards, **Drop**, then **Draw New Card** or **Pick Up** an eligible open card only when required. Different-rank clicks replace the selection; **Select All Matching** groups a rank quickly. Buttons describe the selection, including **Play 2 Sevens**. Normal controls disappear during penalty responses and while waiting for another player.

**Declare Least** is offered only before a Drop when the existing five-or-less eligibility check allows it. Empty hands must declare; zero-point ties and the 40-point failed-declaration penalty remain unchanged. Mandatory closed replacements and penalties without a held 7 continue to resolve automatically. Public Game Activity uses Drop/Least wording, lists newest recent entries first (up to five desktop / three mobile), and keeps full history chronological. Closed cards remain private.

The countdown sits beside the active player's profile, warns at 15 seconds, and becomes urgent at 5 seconds. Untimed games hide it. Neither a Drop, replacement choice, animation, nor reconnect resets the authoritative deadline. The responsive action bar supports touch and keyboard selection alongside the existing overlapping hand and sequential card animations.

### Player hand presentation

Local and online hands use compact overlapping rows of up to seven cards, with raised selected cards and keyboard focus outlines. Larger hands continue on another row on desktop and mobile. The hand summary shows the total points and cumulative score; individual card point labels are omitted. Your profile image or initials appear beside your hand, with initials used if an image fails to load. “Round Joker” is the display name for the existing per-round zero-value rank; its rules have not changed.

### Drop-first opening and pickup eligibility

The first player now uses the same authoritative `turn → draw → next turn` flow as every other normal player. The initial non-7 card is initialized as the eligible prior drop. Drawing is rejected before a legal drop; that drop preserves the old eligible reference while setting a new top group. Match and Drop and 7s finish without replacement. A matching card in hand does not force its use.

Both tables commit the drop before enabling a replacement choice. Drop animation finishes before incoming animation, including automatic closed replacements. Closed cards stay face down in flight. Online flights start only after an authoritative hand update; refreshes restore state without replaying animation. Selection, drop, and replacement share one server deadline.

An opening 7 starts at two penalty cards with an empty player-response list. The starting player is the initiator; playing their 7 adds the first real participant and raises the penalty to four. The computer's card never counts toward the full cycle. A player holding 7s may accept the penalty; without one the draw is automatic. The existing deck supply means an opening full cycle is unreachable at four/eight players (only three/seven 7s remain). No extra cards or unrelated deck rules are added.

Public activity events record completed turns without revealing closed draws. The committed drop, eligibility, normal draw phase, and shared timer survive refresh/reconnection. A one-time compatibility adapter restores old pending saves to normal turns; if the previous release already acquired a card, it preserves that hand and permits one drop without charging another replacement. No new round enters a special acquisition phase. Local opponents use their own cards and the same rules.

Test with `npm test -- src/game/opening.test.ts server/objects.test.ts` and, after building, `PLAYWRIGHT_PREVIEW=1 npm run test:e2e -- e2e/opening.spec.ts e2e/multiplayer.spec.ts`. Browser tests exercise both opening sources, opening 7 actions, timer expiry, 320px/desktop layouts, and saved-state restoration; server tests cover serialized competing pickups and retries.

### Automatic drawing and public activity

A normal nonmatching, non-7 drop automatically draws exactly one closed replacement when no immediately preceding eligible pickup exists. The engine resolves a forced drop/replacement atomically, including recycling/exhaustion, and advances without an extra Draw click. When open pickup is legal, the UI commits the drop, then offers the source choice. A 7 never draws a replacement, including when initiating a penalty; multiple 7s add only two penalty cards, and full-cycle cancellation is unchanged.

Both tables show **Game Activity**: five recent events on desktop, three on mobile, and **View Full History** for scrollable retained history. Events are structured in `src/game/events.ts`, generated by the shared engine during committed actions, persisted/broadcast by the authoritative room, and rendered by `GameActivity`. Public card/group formatters use full names. Closed draws and penalty draws never include card identities in event payloads. Online request deduplication prevents duplicate draws/events. Sequences are scoped to a match; retain the most recent 2,000 across rounds, restoring them on reconnect. Reading older history does not trigger scroll jumps. Old matches preserve up to 40 previously retained public text entries as clearly marked earlier activity. New events have full structured payloads. The legacy `log` string field is a derived compatibility view, not a separate history source.

Printed Jokers use an original inline SVG jester and **JOKER** label. Internal `PJ` identity, zero value, matching, Round Joker rules, and card dimensions remain unchanged.

To verify manually, start a guest room in two browsers: play one or several 7s onto a different rank and confirm no replacement draw; confirm only two penalty cards are added per action; complete a full cycle. Test normal drops after a penalty/timeout (automatic closed draw) and with a legal previous pickup (manual choice). Expand history, scroll upward, let another player act, then refresh and confirm the same retained public events. Check the three-event mobile panel and Joker at 320px. Automated tests cover the engine, Durable Object request retries/private projections, browser controls, and history rendering.

### Sessions, presence, and leaving

Guests receive a cryptographically random session in an HttpOnly, SameSite cookie (Secure on HTTPS). Only its hash is stored on the server. Guest sessions expire after seven days; the same browser and cookies restore the same identity. Signing out invalidates that guest session and leaves the current room. Guests have no email, password, or editable registered profile.

Each identity may belong to one room at a time. Refreshing reconnects the existing seat. Live sockets heartbeat every 20 seconds; after 45 seconds without a heartbeat, a connection is considered offline. Waiting-lobby seats are retained for a further 90 seconds before removal. Explicitly leaving frees a waiting seat immediately. Host ownership transfers deterministically to the earliest connected remaining participant, then earliest remaining participant if nobody is connected. Empty waiting rooms close.

An active game's disconnected seats remain part of the match; disconnecting does not introduce a new forfeit rule or pause timed turns. The server's 60-second deadline still applies. Untimed games have no turn alarm or automatic timeout elimination: a disconnected current player must reconnect to continue. No automatic bot replacement or midgame seat replacement is implemented. Closing a room is available to its host only before the game starts.

Local practice is stored in this tab's `sessionStorage`; other hands are only visually concealed in this offline mode. Online state is persisted in Cloudflare Durable Objects, with private hand projections sent over authenticated WebSockets. Refreshing never resets the server deadline.

## Rulebook and confirmed decisions

Read these documents together:

1. [Current working rulebook](docs/RULEBOOK.md): authoritative gameplay amendments and references to the archived original. The original [Edition 2.0 draft](RULEBOOK.md) retains its gameplay rules, with Drop, Declare Least, and Round Joker terminology updated.
2. [Confirmed rule decisions](docs/rule-clarifications.md): the user's clarifications, which **take precedence over conflicting text in the original draft**.

The initial clarification topics have been answered. The overall rulebook remains provisional and can be refined in later stages; newly discovered ambiguities should be clarified before implementing affected behavior.

### Gameplay reference

The shared engine follows these rules; the linked documents give the full details:

- **Players and dealing:** 2–8 players, seven starting cards each; one standard deck plus one Printed Joker for 2–4 players, or two decks plus two Printed Jokers for 5–8 players.
- **Round Joker:** choose a new eligible indicator each round, excluding 7s and Printed Jokers. Remove that physical card from play; the remaining cards of its rank are worth zero.
- **Normal turns:** drop one card or a same-rank group, then draw one replacement unless playing 7s or matching the previously visible top rank. That Match and Drop action requires no draw.
- **Open pickup:** a required replacement draw may come from the immediately preceding player's latest eligible drop group or the draw pile. Older groups are unavailable. Accepting a 7 penalty or timing out clears eligibility, so the next required replacement draw must come from the draw pile. Match and Drop still requires no draw.
- **Power card 7:** starts a two-card penalty, with two more cards per responding 7 action. Playing one or more 7s ends the action immediately with no replacement draw; it overrides normal drawing and Match and Drop. Multiple 7s in one action still add only two. A full uninterrupted cycle through all active players cancels the penalty.
- **Least:** available at the start of a normal turn with a hand total of five or less. An empty-handed player must declare Least at their next normal turn; passing is not allowed. Least cannot be called during a 7 penalty.
- **Zero-point Least ties:** all zero-point players, including the caller, are tied round winners and receive zero round penalties. The caller does not receive the 40-point failed-Least penalty for a zero-point tie. This exception does not extend to positive-point ties.
- **Elimination and winning:** the default cumulative cutoff is 100 points; reaching or exceeding it eliminates a player. Turns have a 60-second limit, with immediate elimination on timeout. There are no special tiebreaker rounds. Ordinary rounds retain cumulative scores until elimination leaves one match winner.

For example, if the final two players each have 99 cumulative points and tie on a zero-point Least, both remain at 99 and play another ordinary round. A tied round result is not a shared match victory.

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

Vite proxies `/api` and WebSockets to the Worker at port 8787. Use the `127.0.0.1` address to match the local origin allowlist. Local Wrangler state is stored under ignored `.wrangler/`; deleting it removes local sessions and rooms. Guests and local practice need no external provider. The supplied public Supabase project variables are recorded in `wrangler.jsonc`; registered sign-in still needs provider configuration. To override them locally, create the ignored `.dev.vars` using `.dev.vars.example` and the setup guide. Do not commit credentials.

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

Tests cover the existing game rules and local UI, session initialization, provider verification with mocked Supabase, profile ownership, avatar file validation, room settings/membership, private projections, host transfer, atomic starts, server deadlines, and real guest multi-browser rooms. Actual verification/reset email delivery, and real Supabase Storage/RLS checks remain deployment checks in [the setup guide](docs/supabase-setup.md).

## Architecture and files

```text
src/game/                 Framework-independent decks, immutable engine, structured events, bots, tests
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

Registered access uses verified email/password only. Email confirmation and password recovery retain Supabase PKCE, persisted SDK sessions and automatic token refresh. The Worker verifies every bearer token using Supabase `getUser`, requires a verified email, and accesses profiles/Storage with the caller's JWT and public publishable key. No service-role key is used. Profile UUIDs come from verified identity. Emails and account timestamps are returned only by the private self-session endpoint; room projections contain only public names/avatars, presence, scores, and visible cards.

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

Set runtime variables using Cloudflare configuration for both deployment and previews as needed; if Git deploys replace dashboard variables, use Wrangler's documented `--keep-vars` deployment option. Never supply a service-role key, database password, SMTP password to the frontend or these public variables. SMTP credentials belong only in Supabase/provider dashboards.

## Next steps

1. Review this PR and follow [Supabase setup and live checks](docs/supabase-setup.md).
2. Deploy a reviewed build and test verified email access and profile storage against the real project.
3. Playtest registered/guest mixed rooms and reconnection on real mobile networks. Record new rule decisions before changing gameplay.

Substantial changes use pull requests; this feature must not merge automatically. Small trivial updates may go directly to `main` when authorized.
