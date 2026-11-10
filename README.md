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

**Declare Least** is offered only before a Drop when the existing five-or-less eligibility check allows it. Empty hands must declare; zero-point ties and the 40-point failed-declaration penalty remain unchanged. Mandatory closed replacements and penalties without a held 7 continue to resolve automatically. Public Game Activity uses Drop/Least wording, lists the five newest recent entries first, and keeps full history chronological. Closed cards remain private.

The countdown sits beside the active player's profile, warns at 15 seconds, and becomes urgent at 5 seconds. Untimed games hide it. Neither a Drop, replacement choice, animation, nor reconnect resets the authoritative deadline. The responsive action bar supports touch and keyboard selection alongside the existing overlapping hand and sequential card animations.

### Player hand presentation

Mobile local and online hands use one adaptive overlapping row at every count, with raised selected cards and keyboard focus outlines. Desktop retains its existing rows. The hand summary shows the total points and cumulative score; individual card point labels are omitted. Your profile image or initials appear beside your hand, with initials used if an image fails to load. “Round Joker” is the display name for the existing per-round zero-value rank; its rules have not changed.

### Drop-first opening and pickup eligibility

The first player now uses the same authoritative `turn → draw → next turn` flow as every other normal player. The initial non-7 card is initialized as the eligible prior drop. Drawing is rejected before a legal drop; that drop preserves the old eligible reference while setting a new top group. Match and Drop and 7s finish without replacement. A matching card in hand does not force its use.

Both tables commit the drop before enabling a replacement choice. Drop animation finishes before incoming animation, including automatic closed replacements. Closed cards stay face down in flight. Online flights start only after an authoritative hand update; refreshes restore state without replaying animation. Selection, drop, and replacement share one server deadline.

An opening 7 starts at two penalty cards with an empty player-response list. The starting player is the initiator; playing their 7 adds the first real participant and raises the penalty to four. The computer's card never counts toward the full cycle. A player holding 7s may accept the penalty; without one the draw is automatic. The existing deck supply means an opening full cycle is unreachable at four/eight players (only three/seven 7s remain). No extra cards or unrelated deck rules are added.

Public activity events record completed turns without revealing closed draws. The committed drop, eligibility, normal draw phase, and shared timer survive refresh/reconnection. A one-time compatibility adapter restores old pending saves to normal turns; if the previous release already acquired a card, it preserves that hand and permits one drop without charging another replacement. No new round enters a special acquisition phase. Local opponents use their own cards and the same rules.

Test with `npm test -- src/game/opening.test.ts server/objects.test.ts` and, after building, `PLAYWRIGHT_PREVIEW=1 npm run test:e2e -- e2e/opening.spec.ts e2e/multiplayer.spec.ts`. Browser tests exercise both opening sources, opening 7 actions, timer expiry, 320px/desktop layouts, and saved-state restoration; server tests cover serialized competing pickups and retries.

### Automatic drawing and public activity

A normal nonmatching, non-7 drop automatically draws exactly one closed replacement when no immediately preceding eligible pickup exists. The engine resolves a forced drop/replacement atomically, including recycling/exhaustion, and advances without an extra Draw click. When open pickup is legal, the UI commits the drop, then offers the source choice. A 7 never draws a replacement, including when initiating a penalty; multiple 7s add only two penalty cards, and full-cycle cancellation is unchanged.

Both tables show **Game Activity**: five recent events on desktop, with a compact latest summary and five-entry overlay on mobile, and **View Full History** for retained history (paginated on mobile). Events are structured in `src/game/events.ts`, generated by the shared engine during committed actions, persisted/broadcast by the authoritative room, and rendered by `GameActivity`. Public card/group formatters use full names. Closed draws and penalty draws never include card identities in event payloads. Online request deduplication prevents duplicate draws/events. Sequences are scoped to a match; retain the most recent 2,000 across rounds, restoring them on reconnect. Reading older history does not trigger scroll jumps. Old matches preserve up to 40 previously retained public text entries as clearly marked earlier activity. New events have full structured payloads. The legacy `log` string field is a derived compatibility view, not a separate history source.

Printed Jokers use an original inline SVG jester and **JOKER** label. Internal `PJ` identity, zero value, matching, Round Joker rules, and card dimensions remain unchanged.

To verify manually, start a guest room in two browsers: play one or several 7s onto a different rank and confirm no replacement draw; confirm only two penalty cards are added per action; complete a full cycle. Test normal drops after a penalty/timeout (automatic closed draw) and with a legal previous pickup (manual choice). Expand history, visit earlier activity, let another player act, then refresh and confirm the same retained public events. Check the compact mobile activity panel and Joker at 320px. Automated tests cover the engine, Durable Object request retries/private projections, browser controls, and history rendering.

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

## Mobile Development

Capacitor **8.6.0** packages the existing Vite `dist/` build for iOS and Android. Use Node 22.12+ (22.x) or Node 24 as above. Native sources are committed in `ios/` and `android/`; copied web assets, native build output, local SDK paths, and signing files are ignored.

```sh
npm ci
npm run mobile:sync          # Build web assets, then synchronize both platforms
npm run mobile:sync:ios      # Or build/synchronize only iOS
npm run mobile:sync:android  # Or build/synchronize only Android
npm run mobile:open:ios      # Open the generated Xcode project on macOS
npm run mobile:open:android  # Open the generated project in Android Studio
```

`npm run mobile:build` builds the web assets without synchronizing. Run synchronization after web changes or installing/updating Capacitor plugins. The existing `npm run build` and Cloudflare deployment remain independent of native tooling.

**Development identity:** `capacitor.config.ts` sets the name **Least Count** and reads `CAPACITOR_APP_ID`, defaulting to the temporary **`com.example.leastcount`** identifier. This is not the production/store bundle ID. An override must also match the native projects: Android's `applicationId`/`namespace` in `android/app/build.gradle`, the MainActivity Java package/path and package/scheme strings, and the iOS target's Bundle Identifier in Xcode. Capacitor synchronization copies web/config/plugin files; it does **not** rename those native identifiers. Choose and align the production identifiers in a later release-preparation step; do not use the placeholder for store submission. No signing credentials are included.

**Native tools:** iOS compilation requires macOS and a Capacitor-8-compatible Xcode with the iOS SDK. The iOS project uses Swift Package Manager, so CocoaPods is not required. Android compilation requires Android Studio, JDK 21, and Android SDK 36 (the generated project targets API 36, minimum API 24). Open the projects above to resolve native dependencies, select a simulator/device, and build. Linux in this task has JDK 21 but no Xcode/iOS SDK or configured Android SDK: native projects can be generated and synchronized here, but native compilation/device execution is not validated.

**Step 1 boundary:** this bundles the existing app, with no live-reload `server.url`, new plugins, UI changes, auth changes, or backend changes. Relative `/api` and WebSocket requests currently rely on the web Worker at the same origin; the bundled native origins do not supply that backend. Native authenticated/online play therefore needs the next integration step (API transport, allowed origins, session/callback behavior) before it can be claimed to work. That work is intentionally deferred. The framework-independent game and web UI remain shared. Generated launcher/splash assets are development defaults; mobile branding, signing, native builds, and store preparation follow later.

### Fixed-screen mobile application

`MobileOrientation` supplies a shared viewport context to every mobile route. It measures `visualViewport` (with window and `dvh`/`dvw` fallbacks), listens for resize/focus changes, and reserves safe-area insets. `src/app-mobile.css` allocates the actual available height to navigation and content. Mobile pages do not scroll or rubber-band; controls and information are fitted with focused sections and explicit pagination rather than clipped long lists. Desktop presentation retains its ordinary document layout.

`ScreenPages` provides Previous/Next/select navigation for profile overview, statistics groups, buddies, reports and rules. `PagedItems` limits history, metric and social lists while retaining access to every item. Rankings paginate locally within existing server batches. The mobile dashboard provides Create, Join, Profile, Leaderboards, Buddies and Settings. Eight lobby seats fit a compact grid. `CompactForm` keeps inputs mounted and values intact while a reduced keyboard viewport switches to validated field steps; small-height registration also uses steps. Buddy search gets a focused view while typing; closing the keyboard restores its lists. Inputs retain 16px text to avoid iPhone focus zoom. The existing verified-email and guest flows remain; Google sign-in is not reintroduced.

The gameplay shell keeps the timer, active player, Draw/Drop Piles, entire local hand and contextual actions visible. Every mobile hand gets the full table width and a separate action row. Opponents flank the piles; the Round Joker stays in the header. Activity shows the latest summary plus five recent entries in an overlay and paginated full history. Results keep actions beside four scoring rows per page. Room details and match scores use focused modal sections; mobile dialogs do not require nested scrolling.

### Adaptive complete hands

`src/presentation/handLayout.ts` calculates a single row from the measured width, height and card count. `AdaptiveHand` observes the region, preserves the 1:1.4 artwork ratio, adjusts card width/overlap, and reserves selection lift. Every card is represented simultaneously: no hand pages, arrows, carousel, extra rows or scrolling. Stable non-overlapping hit regions expose each upper-left rank/suit. The selected artwork lifts and highlights without moving those hit regions. Existing measured Drop/Draw/pickup flights and reduced-motion behavior are preserved.

Tests touch-select and deselect every card in 7/10/15/20/25/30-card hands; the 30-card case runs at all seven landscape sizes. At the smallest supported landscape size, those 30-card strips expose at least 18px, smaller than the 44px primary action buttons. This is dense card-game input, not a claim that every strip is a standard finger-sized target.

The conservative engine supply bound is **104 cards** (two decks plus Printed Jokers, less indicator/opening Drop). No artificial limit or rule change is introduced. Extreme hands still occupy one row, but can expose only about 5–6px per card on a small phone. Compact mode adds a readable rank/suit inspection line: hold and move across the hand, then release to select; cancelling does not select. Focus also announces the inspected card. Automated coordinate-based selection verifies distinct representations through 104, but cannot establish real-finger accuracy or simultaneous legibility at that density. Physical-device evaluation remains required. Desktop hand presentation is unchanged.

### Orientation and installed PWA testing

`public/manifest.webmanifest` requests `orientation: landscape` and standalone display. On installed mobile PWAs, one supported `screen.orientation.lock('landscape')` request is attempted; unsupported/rejected requests are handled silently without retry loops or fullscreen coercion. The rotation-warning screen and its interaction blocker have been removed. Viewport changes recalculate presentation without remounting game controllers, resetting timers, changing card ownership or replaying actions.

**iPhone limitation:** iOS Safari/Home Screen apps cannot reliably override Portrait Orientation Lock. A CSS virtual-rotation approach was considered, but rotating the app does not rotate the OS keyboard, native modal top layer, safe-area coordinates or the existing measured animation layer. Shipping it without physical input validation would risk incorrect touch/input behavior. It is therefore not enabled. When the OS keeps portrait, the app retains the same landscape-oriented composition without a separate portrait layout or warning. Space and touch density are necessarily constrained; enable system rotation and rotate physically for the intended experience. CSS does not change physical OS orientation.

Native iOS permits Landscape Left and Landscape Right on both iPhone and iPad. `UIRequiresFullScreen` allows the iPad landscape-only configuration and opts out of iPad multitasking. Android retains `sensorLandscape`, supporting both landscape directions subject to OS/multi-window policy. These are native orientation settings, not a promise that a PWA can override device lock. Native compilation and device orientation behavior require Xcode/Android SDK and physical testing; this Linux environment validates configuration and Capacitor synchronization only.

**Install on iPhone:** open [Least Count](https://least-count.chavaphanish.workers.dev/) in Safari, choose **Share → Add to Home Screen**, then launch the icon. Rotate left/right with system rotation enabled. Sign in again if the Home Screen session is separate from Safari. Preview email verification/recovery links require the preview origin in the Supabase redirect allowlist. Production uses the existing API/WebSocket/auth configuration.

**Update an installation:** finish live play, close and reopen the app with connectivity, or use the existing update notice. Entry HTML/manifest/icons revalidate; fingerprinted assets are immutable. The network-only service worker does not queue offline game actions. Server timers continue during backgrounding, network loss and orientation changes. An already-open document retains its loaded code until refreshed. Remove/re-add an old Home Screen icon only if its cached manifest remains stale.

### Mobile validation and screenshots

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run mobile:sync`, then:

```sh
PLAYWRIGHT_PREVIEW=1 npm run test:e2e
# Optional system Chromium in Linux:
PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

The browser matrix covers **667 × 375, 800 × 360, 844 × 390, 852 × 393, 915 × 412, 932 × 430 and 960 × 432**. App checks traverse authentication, dashboard, Create/Join, profile/statistics/history, global/buddy rankings, buddies/settings/rules, loading/retry and eight-seat lobbies. Hand checks include 1/7/10/15/20/25/30/44/104 cards, exposed bounds and taps, matching selection, safe insets, overlays, timer continuation, resize/state preservation and animated Drop/Draw/pickup and replacement-flight positioning during hand growth. Existing engine, account and live multiplayer tests remain regression checks. Keyboard tests emulate a reduced visual viewport and verified-email provider responses; they do not replace real iOS/Android keyboard testing.

[Mobile UX audit and before/after gallery](docs/mobile-ux/README.md) records the baseline findings, all 45 screen/state pairs, the resulting design, and validation. Captures use deterministic mock/local data, not production player information. These are browser captures, not physical-device photographs.

Check both landscape directions, cutouts, real keyboard open/close, accessibility text settings and installed-PWA behavior on real iPhone/Android devices before store release. Native backend-origin integration, signing and store preparation remain later work; see the Mobile Development boundary above. The [previous fixed-screen validation](docs/mobile-layout/validation.md) is a historical record superseded by this single-row audit.

### Android PWA Installation and Testing

Use the existing HTTPS [Least Count website](https://least-count.chavaphanish.workers.dev/) in a recent **Chrome on Android**. No APK, Google Play account, paid service, or native build is required.

1. Open the deployed URL in Chrome (not an embedded social/email browser).
2. Open the **three-dot menu → Install App** or **Add to Home Screen**, and confirm installation. Chrome may offer an installation dialog or a shortcut depending on browser/device policy and support.
3. Launch **Least Count** from the Home Screen. A supported PWA installation opens in standalone mode without the ordinary address bar.
4. Rotate to landscape, sign in with a verified email or continue as guest, then create or join a room. Android, iPhone and desktop all use the same server and rules.

The existing manifest retains the Least Count name/short name, root start URL/scope, `standalone` display, both landscape directions, and 192px/512px icons. The existing 512px spade icon also has maskable purpose: its artwork fits inside the central 80%-diameter safe circle on an opaque background. Installation requires HTTPS (localhost is only a development exception), valid manifest/icons and browser support. Chrome's install prompt also depends on user engagement, existing installations and browser/administrator policy; an eligible manifest does not guarantee an automatic prompt. Use the menu and avoid private/incognito mode for installation.

**Orientation and lifecycle:** Android uses the same fixed mobile shell and supported installed-PWA landscape request described above. Browser tabs, split-screen and device policies may ignore orientation preferences. There is no portrait blocker, and orientation changes do not pause server deadlines. Foregrounding or network recovery obtains a fresh authoritative room snapshot and reconnects its socket. Pending actions are not replayed automatically and offline actions are not queued. Long absences can still cause timeout elimination or loss of a waiting-lobby reservation under existing rules.

**Updates and privacy:** `build/pwa.ts` emits a versioned-content `/sw.js` for production web builds; development and bundled Capacitor apps do not register it. The worker fetches navigation from the network and shows a connection-required page if the network fails. It does not use Cache Storage, intercept API/auth/profile/socket requests, queue offline moves, or provide offline multiplayer. Updates are checked on foreground/network recovery and once per minute while visible/online. A new worker waits rather than forcibly activating/reloading during play. Outside local practice/rooms, **Update and reload** appears when ready: finish your game, return to Dashboard, and accept it. Only the accepting tab reloads; other open games are preserved. Closing all tabs/PWA windows also permits a waiting worker to activate. Ordinary reloads/relaunches fetch current HTML/assets without clearing account or game storage. Browser HTTP caching still respects the existing revalidation/fingerprinted-asset headers. Do not clear site data during a match; it can remove sessions and saved practice progress.

**Physical Android checklist (not yet performed automatically):** install from Chrome's menu; confirm Home Screen icon and standalone launch; rotate both ways and inspect cutouts/insets; select overlapping cards and exercise Drop/Draw/7/Declare Least; join an iPhone/desktop room and compare activity/round results; switch apps, lock/unlock, switch Wi-Fi/mobile data, and disconnect/reconnect. Confirm authoritative hands/deadlines resume and timed-out players stay eliminated. Finish a match, return to Dashboard, accept an update and confirm the new version without clearing your account. Check the offline connection message rather than expecting online play offline. Repeat on your actual Chrome/Android versions and verify real email sign-in.

For automated checks, run `npm run build`, then `PLAYWRIGHT_PREVIEW=1 npx playwright test e2e/android.spec.ts`, or run the full suite as above. Tests cover touch viewports at 800 × 360, 851 × 393, 915 × 412 and 960 × 432, portrait transitions, eligible Declare Least, Chromium installability diagnostics, actual service-worker offline/update behavior, and real Worker rooms with emulated Android/iPhone/desktop clients. OS Home Screen installation, standalone chrome, physical app switching/locking/network transitions and real provider delivery still require device testing. Deploy through the existing Cloudflare build workflow; a branch preview needs a successfully uploaded version and enabled preview URLs, and production needs an activated deployment on `main`.

## Architecture and files

```text
src/game/                 Framework-independent decks, immutable engine, structured events, bots, tests
src/presentation/         Framework-independent adaptive hand geometry and tests
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

Avatar uploads accept JPG/PNG/WebP up to 2 MB, validate signatures on both sides, and use server-generated paths in the owner's folder. The browser also decodes images and limits dimensions to 4096 × 4096. Storage policies enforce ownership. Profile images are public; email is not. Replacing/removing an avatar cleans up its old object. Career/history storage is described in [player careers](docs/player-careers.md); native packaging is described in Mobile Development above.

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
