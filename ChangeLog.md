# Changelog

All notable changes to YAYDU (`least-count`) are documented here.

## Versioning

- The player-facing brand is **YAYDU**; repository, Worker, and API names remain `least-count`.
- Versions follow **Semantic Versioning (`MAJOR.MINOR.PATCH`)** under [AGENTS.md](AGENTS.md): PATCH for small fixes/UI adjustments, MINOR for features/medium functionality changes, and MAJOR for redesigns/architecture/breaking upgrades. Increment once per implementation task; documentation-only maintenance does not bump the application version. `package.json` carries the web version. The earlier `1.1.x` releases retain their recorded history.
- Development before this scheme ran as a single `0.1.0` prototype and is summarized below by milestone.

## 1.7.7 — 25 November 2026

- Leaderboard tabs and ranking rows now share the available panel height, with up to five complete entries visible before scrolling.

## 1.7.6 — 25 November 2026

- Simplified Leaderboards with three vertical tabs, an Achievements placeholder, and scrollable five-row rankings cached until the panel is reopened.

## 1.7.5 — 24 November 2026

- Round Results now names the winning player when a forfeit leaves one player in the round.

## 1.7.4 — 24 November 2026

- Scaled the Printed Joker illustration and label to match the visual size of regular suit symbols in results hands.

## 1.7.3 — 24 November 2026

- Enlarged the Round Results heading in bold gold DM Sans, made panel text bold, centered button labels, and used the available panel height for player rows.

## 1.7.2 — 24 November 2026

- Round Results now stacks the declaration, full-width hand and score table, and equally sized round actions in one landscape panel.

## 1.7.1 — 24 November 2026

- Reduced the width and height of cards in the player’s hand by 15% in local practice and multiplayer.

## 1.7.0 — 24 November 2026

- Reorganize practice and multiplayer tables around a turn-ordered player list and centered hand, with round instructions above and the latest action below.

## 1.6.4 — 23 November 2026

- Enlarge the green online status indicator on profile pictures by a further 10% on every screen (26.5% above its 1.6.2 size). Its position, colour and circular styling are unchanged.

## 1.6.3 — 23 November 2026

- Enlarge the green online status indicator on profile pictures by 15% on every screen. Its position, colour and circular styling are unchanged.

## 1.6.2 — 23 November 2026

- Stretch the signed-out authentication panel to the available column height and distribute its controls vertically. Set the welcome copy in bold.

## 1.6.1 — 23 November 2026

- Arrange the signed-out home screen into two landscape columns, with welcome copy on the left and compact authentication forms on the right.

## 1.6.0 — 23 November 2026

- Guests receive temporary usernames and inactivity expiry. Private visitor statistics distinguish sessions from refreshes and collect optional IP and device details with consent.

## 1.5.3 — 2026-11-23

- Show the header Home icon only during a registered or guest session.

## 1.5.2 — 2026-11-23

- Replaced the Lounge text link with a Home icon in the shared header and removed Rules from the navigation bar.

## 1.5.1 — 2026-11-22

- Round and match results reveal ordered final hands in a compact overlapping card column, including hands retained at timeout or elimination.

## 1.5.0 — 2026-11-22

- Added an interactive three-player Lounge tutorial with deterministic card play, replayable lessons, both Least outcomes and simulated next-round readiness.

## 1.4.0 — 2026-11-21

- Compact round results, final standings and scorecards show every player. Multiplayer adds synchronized readiness, confirmed match forfeits and a shared return to the same waiting lobby for rematches.

## 1.3.0 — 2026-11-21

- **Multiplayer hosting:** Host a Game creates a default room directly. Hosts can adjust player count and elimination threshold in a compact synchronized lobby; reserved seats and server-validated full-lobby starts are preserved. Removed Copy Code and improved immediate native invitation sharing, clipboard/manual fallback and cancellation/error handling.

## 1.2.0 — 2026-11-21

- **My Profile:** replaced redundant identity/XP panels and history/social sections with compact Overview and Stats tabs using existing career data. Edit Profile opens Settings directly on its Profile tab; header, public profiles, editing behavior and internal XP remain unchanged.

## 1.1.38 — 2026-11-21

- **iPhone viewport alignment:** include visual-viewport offsets in the shared mobile viewport and anchor all screen content to that origin. Loading covers share the same visible bounds; scroll-only viewport changes now trigger stabilization without resetting application state.

## 1.1.37 — 2026-11-21

- **Mobile viewport:** remeasure the shared visible viewport during startup, orientation changes and foreground restoration, including delayed iOS PWA stabilization. Reject stale orientation dimensions and skip unchanged updates while preserving keyboard handling, safe-area styling and mounted gameplay.

## 1.1.36 — 2026-11-20

- **Lounge Tutorial:** completed the authenticated Lounge’s existing 2×2 action grid with a matching Tutorial button and an “Under construction” popup dismissed with OK. Existing actions, header and landscape layout are unchanged.

## 1.1.35 — 2026-11-18

- **Dual-logo alignment:** matched the complete visible YAYDU and Chavium Games compositions in height and vertical alignment across loading, transition and rotation screens. Transparent artwork padding and Powered by are excluded; original proportions, gold fills and header branding are preserved.

## 1.1.34 — 2026-11-18

- **Header refinement:** restored the original authenticated profile/XP and navigation row, removing the extra app-brand row and tagline. Signed-out branding now uses smaller, centered YAYDU text with a tighter logo gap and bold white tagline. Lounge content, dual-logo screens, authentication and gameplay are unchanged.

## 1.1.33 — 2026-11-18

- **Shared branding:** added the gold “YAYDU ·” and white “The Game of Sevens” header identity in signed-out and signed-in views while preserving profile, XP and navigation controls. Enlarged and left-aligned the Lounge's three-line tagline, removing its duplicated app heading. Balanced the shared dual-logo composition without its tagline; existing assets, Powered by label and synchronized gold-fill animation are preserved.

## 1.1.32 — 2026-11-18

- **Lounge welcome:** restored rounded frame corners, matched both welcome lines to bold YAYDU typography with similar rendered widths, enlarged and centered the invitation between the heading and forms, and renamed the guest access action to Login as Guest. Existing signed-in layout, session requirements and authentication/gameplay behavior are preserved.

## 1.1.31 — 2026-11-18

- **Lounge entry:** refined signed-out header proportions and logo clearance, added a rectangular shared Lounge surface, and aligned the welcome heading with a three-line tagline. Removed anonymous Play Game access; local practice now waits for a confirmed guest or registered session, including direct URLs and initialization failures. Existing authenticated Lounge, gameplay rules and auth validations remain unchanged.

## 1.1.30 — 2026-11-18

- **Signed-out Lounge:** added a full-width welcome above the existing authentication forms and reused the rotation screen's copyright footer. Signed-out headers show only Rules; guest and registered sessions retain the existing navigation and Lounge. Responsive form rows preserve validation, recovery and invitation handling without backend changes.

## 1.1.29 — 2026-11-17

- **Settings:** reused Your Circle's panel and vertical-tab layout across desktop and mobile landscape. Account now shows the registration date from the existing session, with matching Sign Out/Delete Account button dimensions and a subtle destructive style. Existing settings, profile editing and account confirmation workflows are preserved.

## 1.1.28 — 2026-11-17

- **Your Circle:** replaced the old sections and back link with four leaderboard-style tabs for all friends, ten most-played friends, live online friends, and friend requests. Added partial, case-insensitive username search with relationship-aware actions and compact public-profile rows. Reuses existing presence scheduling, privacy checks and shared-game statistics; no database migration required.

## 1.1.27 — 2026-11-17

- **Room creation:** fixed registered room creation timing out when room initialization called back into the locked Directory to repeat its account-deletion check. Creation retains the Directory's existing check; later room operations retain their own safeguard. Directory transport failures now return a retryable JSON service error. Added serialized Worker/Directory/GameRoom regression coverage for player counts, cutoffs, timed/untimed settings and deletion locks.

## 1.1.26 — 2026-11-17

- **Leaderboards navigation:** moved the Lounge's Leaderboards button to a compact golden trophy icon between Lounge and Buddies in the shared header. Reuses the existing route and icon interaction styles, with a Leaderboards tooltip, accessible label and current-page indicator. A mobile header container sizing fix lets existing name truncation keep all controls within narrow viewports, without resizing the other icons or altering Lounge content.

## 1.1.25 — 2026-11-17

- **Online presence:** shared avatars now show a subtle green online dot across buddies, rankings, profiles and multiplayer rooms. Authenticated session heartbeats run about every 30 seconds and expire after 60 seconds, with multi-session aggregation, session-scoped sign-out and deletion cleanup. One app-level scheduler batches visible-avatar lookups using existing Durable Objects; no database migration, profile polling or public session details.

## 1.1.24 — 2026-11-17

- **Premium Lounge:** redesigned the welcome area with prominent, responsive typography and a balanced two-by-two grid of illustrated action tiles. Refined the existing green-and-gold palette, spacing, borders and interaction states for desktop and mobile landscape without scrolling. Preserves every label, action and notice; the top header is unchanged.

## 1.1.23 — 2026-11-17

- **Buddies navigation:** moved Buddies from the Lounge to a compact golden users icon between Lounge and Mailbox in the header. Reuses existing icon styles and buddy functionality; direct links, reloads and return navigation work across desktop and mobile landscape.

## 1.1.22 — 2026-11-17

- **Account deletion:** added a destructive Delete Account action with permanent-deletion warning, typed confirmation and current-password verification. Authenticated server-owned cleanup removes avatar files and the authentication account, cascades dependent personal records, and anonymizes shared history and retained room identities. Durable progress/retries continue independently of the browser; active games must finish before deletion starts. Production requires the account-erasure migration and scoped room-enumeration credentials described in the [rollout guide](docs/account-deletion.md).
- **Profile editor:** all identity fields and Save Changes now share one compact view, alongside the current photo and overlapping pencil upload control. Reuses existing identity validation, photo optimization, retry/removal and session refresh. No profile-section pagination or page scrolling is needed on mobile landscape.

## 1.1.21 — 2026-11-17

- **Tabbed Settings:** added vertical Account, Sounds, and Profile tabs using the existing golden career-tab styling. Sign Out now lives only in Account instead of the Lounge; Sounds reuses all existing sound, haptic, and turn-notification controls. Profile reuses the existing identity and photo editors, validation, upload optimization, and save behavior, without exposing other editable account fields. Removed Settings’ Back to Lounge button; the header remains the return navigation. Compact profile sections keep mobile landscape layouts within the viewport.

## 1.1.20 — 2026-11-16

- **Header navigation:** Rules and Lounge are followed by compact mailbox and settings icons. Mailbox opens the existing themed popup with “Under Construction.”; Settings opens the existing settings panel at `#/settings`, including direct links and reloads. Removed My Profile and Settings from the Lounge; the entire header identity still opens My Profile. Mobile landscape alignment, keyboard focus, and existing settings controls are preserved.

## 1.1.19 — 2026-11-16

- **Lounge layout:** stacked matching gold Create Game Room, Join Game Room, and Local Practice actions on the left; moved the greeting to the right with account navigation. Removed the duplicate Lounge avatar/XP, introductory text, bottom practice/rules links, and Lounge header Profile button. The header identity and XP display remain unchanged. Returning registered players are recognized by existing recorded game participation; new players receive a personalized welcome. Room flows, guest restrictions, and landscape responsiveness are preserved.

## 1.1.18 — 2026-11-16

- **Compact header:** tightened player name/username spacing and proportionally reduced the profile picture on desktop and mobile. Avatar, player details, and the single-row Level | XP display remain vertically aligned, with the progress bar below. Existing styling, identity, and navigation are preserved.

## 1.1.17 — 2026-11-16

- **Header XP progress (#42):** replaced the text-only XP block with a compact gold progress bar, current level, and earned/required XP toward the next level. Reuses the existing career data, `xpProgress()` calculation, and Lounge progress styling without additional API calls. Avatar, full name, username, and navigation remain unchanged. Verified on desktop and mobile landscape down to 568×320.
- **Local Practice bot selector (#41):** renamed “Players at the table” to **Number of Bots**, with a compact numeric **1–7** dropdown beside the label. Games add one human automatically; the default remains three bots plus one human. Removed the deck/Joker description and preserved the existing theme and gameplay.
- **Verification:** both changes passed their production builds and focused desktop/mobile browser checks; the XP calculation test also passed. Cloudflare production deployment checks succeeded for both merged PRs.

## 1.1.16 — 2026-11-15

- **Header player profile:** the top bar no longer shows the game logo and "YAYDU · The Game of Sevens" wordmark for signed-in players. It now shows the player: small profile picture on the left, full name with the username beneath it, and a Level/XP block (from the career profile) beside a divider — all fitting the existing header bar and linking to the profile page. Signed-out visitors still see the original brand; guests show their display name with a "Guest player" caption and no Level block (guests stay casual).

## 1.1.15 — 2026-11-15

- **Guest popup polish:** the OK button in the guest multiplayer notice no longer shows the gold focus frame on open (its automatic focus was removed) and is now centered in the popup. Message text and dismissal behavior are unchanged.

## 1.1.14 — 2026-11-15

- **Guest block moved to the lounge buttons:** for guests, clicking **Set the Table** or **Take a Seat** now shows the under-testing popup immediately instead of opening the room form (the submit guard and backend gate remain as backup). Settings, Local Practice and every other lounge destination are unchanged; registered users are unaffected.

## 1.1.13 — 2026-11-15

- **Guest online multiplayer temporarily disabled:** guests can still sign up as guests and play Local Practice, but every online multiplayer entry point is blocked while the mode is under testing. Attempting to host, join, open an invite link, or enter a room as a guest now shows a modal notice — *"Multiplayer Online Mode for Guests is currently under testing. Please sign up or sign in to play online."* — with an **OK** button that returns the player to safety. Registered users are unaffected.
- **Single revert flag:** `GUEST_MULTIPLAYER_ENABLED = false` in `src/shared/multiplayer.ts` controls everything. The frontend reads the flag through `/api/config` (`guestMultiplayerEnabled`) and fails closed if the field is missing; the Worker enforces the same gate on every room route (`POST /api/rooms` and join/ticket/start/view; `leave`/`close` stay open for graceful exit) so it cannot be bypassed client-side. The Worker variable `GUEST_MULTIPLAYER_ENABLED=true` overrides the flag for e2e runs only.
- **Verification:** typecheck, 397 unit tests (new Worker gate tests + config flag test), production build, and targeted e2e (multiplayer, mobile, ux-interactions, lounge, host-transfer, public-identity, app-layout, animated-loading, dual-brand, feedback, replacement-buttons) show no new failures — every failing case was re-confirmed failing on clean `main`. A throwaway probe verified the popup message verbatim, OK dismissal, Local Practice access, and invite-link handling for guests.

## 1.1.12 — 2026-11-15

- **45-second turns:** timed turns now last **45 seconds** instead of 60 (`src/game/engine.ts` `TURN_MS`, room settings validation in `src/shared/multiplayer.ts`, and all player-facing copy — Dashboard, GamePage setup, RoomPage status pill, Rules page, timeout notices, and the rulebooks/README). Room creation still offers timed or untimed only; the fixed duration is 45 s.
- **Reminder retimed:** the once-per-turn reminder sound (file unchanged, `50s_Reminder.mp3`) now plays at the **30-second** mark of the local player's turn (was 50 s); the 15-second tick loop is unchanged (`src/feedback/tracker.ts`).
- **Verification:** typecheck, 391 unit tests (deadline assertions updated to the 45 s turn length), production build, and the public-identity e2e suite pass. The `feedback.spec` bell assertion failures were each re-confirmed failing on clean `main` and are pre-existing; its decode-count assertions were updated for the ten now-preloaded assets.

## 1.1.11 — 2026-11-15

- **50-second turn reminder:** a new sound (`public/audio/50s_Reminder.mp3`) plays **once** when the local player's own active turn drops to 50 seconds remaining. It uses the same authoritative-crossing logic as the existing 15-second tick loop (`src/feedback/tracker.ts`), respects the Sound Effects toggle and the tab-visibility guard, and never replays for the same turn, for opponents' turns, or in untimed games. No other sounds or features changed.
- **Verification:** typecheck, 391 unit tests (including a new reminder-crossing test), and the production build pass.

## 1.1.10 — 2026-11-15

- **Improved sound effects:** all game audio files in `public/audio/` were replaced with improved versions (card deal/draw/pickup/drop, timer tick, turn bell, round & game applause). No playback code changed.
- **Verification:** production build passes with the new audio embedded; no code or test changes.

## 1.1.9 — 2026-11-14

- **First names in gameplay:** during gameplay (local practice and online rooms) the UI now shows only each player's **first name** — last names and usernames are removed from the active-player banner, opponent seats, your-hand header, turn timers, round/match results, match-score rows, game notices, the lobby seat list, and the host-transfer dialog. Full names and usernames are unchanged in the database, profiles, leaderboards, buddies, career pages, and game history; avatar initials and alt text are also unchanged (`src/shared/playerIdentity.ts`, gameplay components and pages).
- **Verification:** typecheck, 390 unit tests, production build, and the public-identity, host-transfer, and gameplay e2e suites pass; visual screenshot review of the lobby, table, and local game on desktop and mobile confirms first-name-only display. The remaining `game`/`multiplayer`/`mobile`/`fixed-table` e2e failures were each re-confirmed failing on clean `main` and are pre-existing.

## 1.1.8 — 2026-11-14

- **Round penalties (#38):** successful Declare Least losses are now capped at 40 round penalty points per player, matching the failed-Least penalty; the zero-point tied-Least example was corrected accordingly (`engine.ts`, `docs/rule-clarifications.md`, `docs/RULEBOOK.md`).
- **Host transfer (#39):** when the host is eliminated, hosting transfers to another seat without pausing gameplay (`server/room.ts`, `server/objects.ts`).
- **Timeout forfeits (#40):** players who time out in a round are forfeited for that round with a single 40-point penalty instead of the legacy timeout-elimination flow; career metrics now track round timeout forfeits separately from score eliminations (`server/room.ts`, `docs/player-careers.md`).
- **Verification:** typecheck, unit tests, and production build pass on the merged result.

## 1.1.7 — 2026-11-13

- Released for a few minutes as a leaderboard layout optimization (dynamic scrollable list, personal rank in the left column) and then fully reverted on request; no lasting changes. The version number is skipped.

## 1.1.6 - 2026-11-12

- **Update screen:** the update button is wider (min 320px), centered, no longer autofocuses (removing the golden focus frame), and its label reads **"Update to latest version"** (`PwaStatus.tsx`, `branding.css`); the e2e was updated to the new accessible name.
- **Verification:** typecheck, 330 unit tests, production build, the real service-worker update lifecycle e2e, and a visual screenshot review pass.

## 1.1.5 — 2026-11-12

- **Docs:** added `TODOS.md` tracking the next planned items — dual-logo layout adjustments, player profile in the top-left header when signed in, quit/stand-up/exit-room flows, and simplified local practice (bot count + threshold).

## 1.1.4 — 2026-11-12

- **Brand screens:** on the loading, rotation-guard, and update screens the tagline ("The Game of Sevens") now uses the same DM Sans 700 style and letter-spacing as the YAYDU wordmark, sized much smaller so it sits neatly beneath it.
- **Brand alignment:** the whole YAYDU stack (logo + wordmark + tagline) now stretches to exactly the same height as the "Powered by" + Chavium Games block, with top and bottom edges aligned; the square YAYDU logo flexes to fill the leftover vertical space (`branding.css`).
- **Test fix:** `dual-brand.spec.ts` now matches the copyright line by pattern instead of exact text, fixing a failure introduced when 1.1.2 appended the version to it.
- **Verification:** typecheck, 330 unit tests, the dual-brand, orientation-guard, and Lounge e2e suites, and visual screenshot review of all three screens pass. The remaining e2e failures (`dual-brand` route-cover flow, `android` touch play ×4 and resume, `app-layout` keyboard signup and ranking pages, `ux-audit` public profile, `lounge-navigation` ×3) were each confirmed failing on clean `main` and are pre-existing.
- **Documentation screenshots:** `docs/mobile-layout/*` refreshed by the app-layout audit with the new brand presentation.

## 1.1.3 — 2026-11-12

- **Lounge buttons:** the gold buttons in the Create Game Room and Join Game Room cards now have centered text, and their labels changed to **"Set the Table"** and **"Take a Seat"** (card headings stay "Create Game Room" / "Join Game Room"). All e2e specs that click these buttons by name were updated to the new labels.
- **Documentation screenshots:** the auto-generated doc captures that show the Lounge (`docs/mobile-layout/*`, `docs/mobile-ux/after/*`) were refreshed by their generating audit specs so they reflect the new buttons; unlike previous unrelated churn, these were committed this time.
- **Verification:** typecheck, 330 unit tests, production build, and the Lounge, orientation-guard, app-layout, and ux-audit e2e suites pass; the one ux-audit failure (`Other Player` heading on `/player/lc_other`) is pre-existing on clean `main`.

## 1.1.2 — 2026-11-12

- **Update screen:** the gold **Update** button is now horizontally centered on the full-screen update view.
- **Copyright line:** the shared `BrandCopyright` footer (boot/loading, orientation guard, and update screens) now appends the current app version, e.g. "© 2026 Chavium Games Pvt. Ltd. | ver. 1.1.2". The version comes from `package.json` via a new `__APP_VERSION__` constant injected by the Vite build (`vite.config.ts`, `vite-env.d.ts`, `DualBrand.tsx`).
- **Verification:** typecheck, 330 unit tests, production build, the real service-worker update e2e, and a visual screenshot review pass.

## 1.1.1 — 2026-11-12

- **Lounge:** the Create Game Room and Join Game Room cards no longer show the ♠/♣ suit symbols or "Create a room →"/"Join your friends →" text links; each card now carries a regular gold primary button labeled "Create Game Room" / "Join Game Room". Desktop and mobile card layouts were cleaned of the dead symbol/link styles (`DashboardPage.tsx`, `styles.css`, `app-mobile.css`).
- **Verification:** typecheck, 330 unit tests, production build, and the Lounge, orientation-guard, and app-layout e2e suites (27 passed) pass; the three failures in `lounge-navigation.spec.ts` "gold buttons share states and retain navigation" are pre-existing on clean `main` (mobile main-menu `boundingBox()` race, unrelated to this change).

## 1.1.0 — 2026-11-12

First release under the `1.1.x` versioning scheme.

- **Documentation:** corrected the avatar upload limit to 5 MB (`README.md`, `docs/supabase-setup.md`); described the real browser pipeline (decode, center-crop, 512 × 512 WebP) and the `202611060001_avatar_limits.sql` bucket raise (`0461865`).
- **Access forms:** the signup step-2 email placeholder and the password-reset email placeholder now read `email` instead of `yourmail@provider.com`; sign-in keeps its "Email or username" hint (`02c18c9`, `17c3535`).
- **App updates:** the ready service-worker update is now a full-screen branded view — loading-screen logos (YAYDU and Chavium Games), a cream message line, and a primary gold **Update** button — instead of the small bottom bar. It still never interrupts a live table, reloads only the accepting tab, and the offline notice remains a compact status bar (`e6cf915`).
- **Verification:** typecheck, 330 unit tests, production build, the real service-worker update e2e, signup e2e (10/10), and accounts e2e (5/5) pass on Windows with Node 26.

## 0.1.0 — initial development (2026-11-05 → 2026-11-12)

Prototype line before the versioning scheme; grouped milestones in ship order.

- **Rules foundation:** provisional Least Count rulebook (Edition 2.0 draft), confirmed decisions on open pickup, zero-point Least ties, and elimination; no tiebreaker rounds (`ec46ebf`–`89e5120`).
- **Local gameplay:** playable local game, staged drop/pickup animations, browser tests (`5eef6f4`–`a4e5cc2`).
- **Accounts and multiplayer:** verified sessions, profiles, authoritative rooms with private hand projections; public Supabase runtime configuration (`b405c83`–`5cc7ce7`).
- **Rules refinements:** corrected 7 and forced draws, public activity history, Joker art; verified-email-only access after removing Google sign-in (`f4cf854`–`84ee3ad`).
- **Opening turn:** draw-first opening selection, then restored discard-first opening with sequenced animations (`aa90a95`, `d8f550a`).
- **Presentation:** compact hands, Round Joker terminology, guided Drop/Least action bar (`089e317`–`49a8fb9`).
- **Player careers:** durable XP ledger, profiles, statistics, history, buddies, rankings; optimized avatar uploads and permission verification (`4c178f7`–`a939355`).
- **Mobile:** Capacitor iOS/Android foundation, landscape iPhone Home Screen support, Android PWA installation and lifecycle updates, fixed landscape gameplay table (`c8fe805`–`d32314b`).
- **Mobile UX:** complete single-row adaptive hands, screen fitting, landscape orientation guard, Lounge rename and navigation (`c2d32ef`–`ad29a22`).
- **Identity:** three-step signup validation, legacy usernames, public player names with usernames (`7f7a044`, `ad0b8ec`).
- **Branding and feedback:** Chavium Games branding on loading/rotation screens, animated studio logo fill, YAYDU rebrand, original audio, haptics, and turn alerts (`9ab1fb2`–`dde0ab3`).
- **Access polish:** three-step signup enforcement, authentication form labels and alignment (`70f5b17`, `ead8d95`).
