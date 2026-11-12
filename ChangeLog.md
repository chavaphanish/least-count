# Changelog

All notable changes to YAYDU (`least-count`) are documented here.

## Versioning

- The player-facing brand is **YAYDU**; repository, Worker, and API names remain `least-count`.
- From 12 November 2026 onward, versions follow **`1.1.x`**. Each change set that ships to `main` increments the patch number (`1.1.1`, `1.1.2`, …). `package.json` carries the current version.
- Development before this scheme ran as a single `0.1.0` prototype and is summarized below by milestone.

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
