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

### Landscape mobile and iPhone Home Screen testing

Phones and tablets use landscape. `public/manifest.webmanifest` requests `orientation: landscape`, `display: standalone`, root scope/start URL, and includes 192px/512px PNG icons derived from the existing spade favicon. `index.html` includes the 180px Apple touch icon, standalone metadata, and `viewport-fit=cover`. The existing HTTPS Worker serves the app; no additional hosting service is required.

iOS Safari/Home Screen apps may ignore the manifest orientation preference. We do not request JavaScript orientation locks or rotate the game with CSS. A mobile-only **Rotate Your Phone** screen uses the viewport orientation media query and blocks pointer/keyboard interaction with `inert`. The underlying React tree stays mounted: hands, selections, sessions, WebSockets, and deadlines remain intact. **Live turns continue while the message is displayed.** Both landscape directions are supported. Desktop windows remain usable in portrait proportions, including narrow windows. Detection covers Android, iOS, and iPadOS's desktop user agent.

Mobile landscape gameplay uses a dedicated fixed viewport with the same felt table and card artwork. The hand and action bar share the bottom, Draw/Drop Piles occupy the center, and compact opponents and game information stay above them. Secondary information opens in overlays. See the fixed-screen architecture below. Inputs use 16px text to avoid iPhone focus zoom; pinch zoom remains available outside the gameplay presentation.

**Install on iPhone:**

1. Open the test URL supplied with the PR in **Safari**. Production is [least-count.chavaphanish.workers.dev](https://least-count.chavaphanish.workers.dev/); unmerged changes require the branch's published Cloudflare preview. A successful version upload alone does not activate that version on the production address.
2. Tap **Share → Add to Home Screen**, keep the name **Least Count**, and tap **Add**. If offered, leave **Open as Web App** enabled.
3. Launch the new Home Screen icon and rotate the iPhone horizontally. Turn off iOS Portrait Orientation Lock if rotation does not change the viewport. The rotation screen disappears when the viewport becomes landscape; no reload is needed.
4. Sign in using your verified email or use a guest session. The Home Screen installation may have separate storage/session state from Safari, so sign in again if prompted. Same-origin API/WebSocket routes and existing authentication are unchanged. Preview email verification/recovery links require the preview URL in the existing Supabase redirect allowlist; production links retain the existing production configuration.

**Update an installation:** close the Home Screen app from the app switcher and reopen it with connectivity. If necessary, open the same URL in Safari and reload. The production app uses a **network-only service worker**, without an offline app-shell or gameplay cache. Cloudflare's `public/_headers` makes entry/deep-link HTML, manifest, icons and the worker revalidate, while Vite's fingerprinted assets are immutable. An already-open page keeps its current code until reloaded; see the Android section below for the explicit update notice shared by web/PWA users. If an old Home Screen icon/manifest persists, remove that icon, reload the intended URL in Safari, and add it again. Clearing Safari website data is a last resort: it can sign you out and remove saved practice progress. Finish live games before refreshing/reinstalling. Online games require a connection; iOS may suspend network activity when the app is backgrounded or the phone locks. The overlay itself does not background or pause the game.

**Manual iPhone checklist (physical-device testing still required):**

- Launch from the Home Screen, check the name/icon/standalone view, and confirm portrait shows the rotation message.
- Rotate left and right; inspect cutouts/home indicator, readable ranks/suits, names/card counts, timer, Draw/Drop Piles, Round Joker, action buttons, and Game Activity.
- Select a card, rotate to portrait and back, and confirm the selection and round remain. Drop/draw once and check there are no duplicate actions.
- Try a large penalty hand, use its page arrows, and check that every card can be selected. Check every compact opponent and the full activity overlay.
- Sign in with a verified email, reconnect after relaunch, and play a two-device room. While holding the active player's phone vertically, let a timed turn expire; verify the server applies the normal timeout and both devices agree.
- After a deployment, reopen/reload and confirm the new version appears. Check keyboard focus and Safari browser controls as well as the Home Screen view.

**Native orientation:** `ios/App/App/Info.plist` supports only Landscape Left/Right on **iPhone**. iPad retains all four supported native orientations to satisfy iPad multitasking requirements; the same portrait guard enforces the game presentation in portrait/split windows. Android's main Activity uses `sensorLandscape` for both landscape rotations. Android large-screen/multitasking modes may ignore orientation requests; the presentation guard remains the fallback. No orientation plugin is needed. Run `npm run mobile:sync` after web changes. Native compilation/signing remains unverified on Linux; the next native test step requires a Mac/Xcode, a chosen bundle ID and signing team, followed by native API/session integration from the Step 1 boundary above before claiming authenticated multiplayer works in a bundled app.

**Automated mobile checks:**

```sh
npm run typecheck
npm test
npm run build
PLAYWRIGHT_PREVIEW=1 npx playwright test e2e/mobile.spec.ts
PLAYWRIGHT_PREVIEW=1 npm run test:e2e
npm run mobile:sync
```

The mobile suite emulates iPhone touch viewports at 667 × 375, 844 × 390, 852 × 393, and 932 × 430; checks portrait/landscape transitions, state/selection/deadline preservation, cards/controls/log visibility, large hands, simulated safe insets, desktop/iPad detection, install assets/deep links, and a real Worker/WebSocket timeout behind the rotation screen. These are browser automation checks, not evidence of real Safari/Home Screen or native device execution. Existing verified-email tests use a mocked provider; actual email delivery and physical iPhone sessions remain manual checks.

### Fixed-screen mobile gameplay architecture

`MobileOrientation` supplies a presentation context shared by local and online screens. Only an active mobile landscape table gets the fixed `100dvh`/`100dvw` shell (with viewport-unit fallbacks); authentication, profiles, rules and other screens retain normal scrolling. CSS recalculates the grid and overlap on viewport changes and reserves `env(safe-area-inset-*)` on every side. Gameplay document scrolling and rubber-band overscroll are disabled **after** the layout allocates real space for all essential controls. Internal scrolling is confined to secondary dialogs and round results.

- **Essential:** a narrow `MobileGameBar` shows round, active player, timer, Round Joker and 7 penalty. The felt center prioritizes Draw/Drop Piles. The bottom reserves space for the readable hand and 44px primary actions simultaneously.
- **Supporting:** `OpponentSeat` adapts all one-to-seven opponents into a single compact row, with initials/photo, short name, card count, eliminated state and active-turn highlight. No opponent scrolling is needed. Tap an indicator for permitted public details; hidden cards stay private.
- **Secondary:** `TableOverlay` uses native modal dialogs with focus containment, Close/Escape/backdrop dismissal and safe-area bounds. Table options contain room controls/help/match scores. Activity shows one latest-action line plus an Activity button; its dialog shows the latest **five** events newest first, and full history chronologically. Opening/closing dialogs never pauses or mutates a match.

`PlayerHand` keeps ordinary one-to-seven-card hands on a single strip without paging. Larger hands use five-card pages, bounded overlap and the same 64–80px card widths rather than indefinitely shrinking cards. Arrow controls reach every card; selection lives in the existing parent game screen and survives paging, overlays and rotation. A received animated card reveals its page before flight measurement. Off-page selected cards depart from the visible hand anchor. Selected cards rise above neighbors with a slight horizontal offset to retain readable adjacent corners. Desktop hands keep their existing seven-card rows.

The shared `TurnActions` preserves phase validation, eligibility and callbacks. Mobile hides redundant long hints; replacement choices retain an immediately available pickup plus a dialog for additional eligible cards. Existing validated Drop/Draw/pickup/Match and Drop/7 flights use live DOM measurements and a clipped fixed animation layer; new-card arrivals cover deal/penalty/round additions. A resize finishes decorative flights without replaying an action. Reduced-motion preferences are respected. No game-engine, scoring, authentication, backend or rulebook changes are involved.

Run `npm run build` then `PLAYWRIGHT_PREVIEW=1 npx playwright test e2e/fixed-table.spec.ts`, or the full browser suite above. The fixed-table matrix covers **667 × 375, 800 × 360, 844 × 390, 852 × 393, 915 × 412, 932 × 430 and 960 × 432** with **2/4/6/8 players**, seven- and twenty-card hands; additional cases exercise 1/10/15/21/31 cards, overlays, all action phases, safe insets, rotation, deadline continuation and animated overflow. Tests check element bounds/readable sizes and reachability in addition to a non-scrolling document; hiding overflow alone is insufficient. Real-device Home Screen behavior, accessibility zoom and OS/browser UI still require manual checks, especially on viewports shorter than the tested sizes.

Browser-emulation screenshots for review: [small iPhone/four players](docs/mobile-layout/iphone-small-4.png), [large iPhone/four players](docs/mobile-layout/iphone-large-4.png), [Android/eight players](docs/mobile-layout/android-8.png), [21-card hand](docs/mobile-layout/large-hand-21.png), [Power 7](docs/mobile-layout/power-seven.png), [replacement](docs/mobile-layout/replacement.png), [Declare Least](docs/mobile-layout/declare-least.png), and [activity overlay](docs/mobile-layout/activity.png). These are automated browser captures, not physical-device photographs.

### Android PWA Installation and Testing

Use the existing HTTPS [Least Count website](https://least-count.chavaphanish.workers.dev/) in a recent **Chrome on Android**. No APK, Google Play account, paid service, or native build is required.

1. Open the deployed URL in Chrome (not an embedded social/email browser).
2. Open the **three-dot menu → Install App** or **Add to Home Screen**, and confirm installation. Chrome may offer an installation dialog or a shortcut depending on browser/device policy and support.
3. Launch **Least Count** from the Home Screen. A supported PWA installation opens in standalone mode without the ordinary address bar.
4. Rotate to landscape, sign in with a verified email or continue as guest, then create or join a room. Android, iPhone and desktop all use the same server and rules.

The existing manifest retains the Least Count name/short name, root start URL/scope, `standalone` display, both landscape directions, and 192px/512px icons. The existing 512px spade icon also has maskable purpose: its artwork fits inside the central 80%-diameter safe circle on an opaque background. Installation requires HTTPS (localhost is only a development exception), valid manifest/icons and browser support. Chrome's install prompt also depends on user engagement, existing installations and browser/administrator policy; an eligible manifest does not guarantee an automatic prompt. Use the menu and avoid private/incognito mode for installation.

**Orientation and lifecycle:** the existing rotation screen and landscape layout apply to Android as well as iPhone. No JavaScript orientation lock is requested; the manifest preference can be ignored in browser tabs, split-screen modes or some device settings. Rotate physically/use the system auto-rotate setting if needed. The portrait screen blocks interaction without pausing server deadlines. After foregrounding, a persisted page restore or network recovery, a room obtains a fresh authoritative snapshot and reconnects its socket. Failed/pending actions are not automatically replayed, timers are not extended, and offline actions are not queued. Long absences can still cause timeout elimination or loss of a waiting-lobby reservation under the existing rules. A network banner explains that online games need a connection.

**Updates and privacy:** `build/pwa.ts` emits a versioned-content `/sw.js` for production web builds; development and bundled Capacitor apps do not register it. The worker fetches navigation from the network and shows a connection-required page if the network fails. It does not use Cache Storage, intercept API/auth/profile/socket requests, queue offline moves, or provide offline multiplayer. Updates are checked on foreground/network recovery and once per minute while visible/online. A new worker waits rather than forcibly activating/reloading during play. Outside local practice/rooms, **Update and reload** appears when ready: finish your game, return to Dashboard, and accept it. Only the accepting tab reloads; other open games are preserved. Closing all tabs/PWA windows also permits a waiting worker to activate. Ordinary reloads/relaunches fetch current HTML/assets without clearing account or game storage. Browser HTTP caching still respects the existing revalidation/fingerprinted-asset headers. Do not clear site data during a match; it can remove sessions and saved practice progress.

**Physical Android checklist (not yet performed automatically):** install from Chrome's menu; confirm Home Screen icon and standalone launch; rotate both ways and inspect cutouts/insets; select overlapping cards and exercise Drop/Draw/7/Declare Least; join an iPhone/desktop room and compare activity/round results; switch apps, lock/unlock, switch Wi-Fi/mobile data, and disconnect/reconnect. Confirm authoritative hands/deadlines resume and timed-out players stay eliminated. Finish a match, return to Dashboard, accept an update and confirm the new version without clearing your account. Check the offline connection message rather than expecting online play offline. Repeat on your actual Chrome/Android versions and verify real email sign-in.

For automated checks, run `npm run build`, then `PLAYWRIGHT_PREVIEW=1 npx playwright test e2e/android.spec.ts`, or run the full suite as above. Tests cover touch viewports at 800 × 360, 851 × 393, 915 × 412 and 960 × 432, portrait transitions, eligible Declare Least, Chromium installability diagnostics, actual service-worker offline/update behavior, and real Worker rooms with emulated Android/iPhone/desktop clients. OS Home Screen installation, standalone chrome, physical app switching/locking/network transitions and real provider delivery still require device testing. Deploy through the existing Cloudflare build workflow; a branch preview needs a successfully uploaded version and enabled preview URLs, and production needs an activated deployment on `main`.

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
