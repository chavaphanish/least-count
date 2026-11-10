# Mobile UX review and evidence

The baseline audit was completed at `c2d32ef` before application edits: [findings and priorities](AUDIT.md), [baseline measurements](before/bounds.json). The redesign preserves the existing felt table, card assets, colors, rules, server authority, verified-email/guest access and career calculations. No dependencies or paid services were added; Google sign-in remains removed.

## What changed

- **Gameplay:** every mobile hand uses one full-width overlapping row at every count, with a nearby horizontal action bar. Opponents flank Draw/Drop Piles; the Round Joker appears once in the header. Selection raises/highlights cards while their hit regions stay stable. Existing measured flights and authoritative transitions remain intact.
- **Dense hands:** all cards are represented at once. When exposed strips become very narrow, a readable inspection line supports hold/move/release selection and keyboard focus. Cancellation does not select. No hand pagination, carousel, scrolling, arrows or extra rows.
- **Entry/dashboard:** balanced landscape authentication, genuine startup progress, consistent controls and keyboard steps. Dashboard emphasizes Create/Join beside one identity/XP rail, with compact secondary navigation and a visible return action for existing rooms.
- **Lobby:** explicit status/grid rows retain eight seats during disconnects; host and connected seats are distinguished. Start rules and permissions are unchanged.
- **Results/dialogs:** shared four-row score pagination keeps next-round/final leave actions visible. Table details and full activity history use sections/pages instead of nested scrolling. Recent activity retains the newest five public events; full history retains its existing chronological order and privacy. Each concise entry opens its complete public text in paginated detail, including long eight-player scoring summaries.
- **Careers/social:** direct career tabs remove a navigation level, all eight overview metrics remain available, detailed metrics/history retain their pages, buddy search aligns input/action, and profile upload errors span the panel. Editing/account access also stays reachable when careers are disabled or unavailable. Drafts survive section changes; abandoning an edited profile through a route link or reloading prompts before loss.
- **Consistency:** reusable spacing, type, radius and control tokens; common status treatment, close/back controls and focus behavior. Existing rules, settings, reports, rankings and public profiles share the fixed mobile shell.

## Changed-file map

| Area | Files |
| --- | --- |
| Hand geometry and input | `src/presentation/handLayout.ts`, its unit test, `src/components/AdaptiveHand.tsx` |
| Shared presentation | `src/mobile-tokens.css`, `src/app-mobile.css`, `src/main.tsx`, `src/components/ScreenPages.tsx`, `Layout.tsx`, `MobileGameBar.tsx`, `GameActivity.tsx`, `ResultScores.tsx`, `RoundSummary.tsx` |
| Screens and career presentation | `src/pages/AccessPage.tsx`, `DashboardPage.tsx`, `ProfilePage.tsx`, `GamePage.tsx`, `RoomPage.tsx`, `src/career/CareerGlance.tsx`, `CareerProfile.tsx`, `Buddies.tsx` |
| Browser acceptance | `e2e/app-layout.spec.ts`, `fixed-table.spec.ts`, `multiplayer.spec.ts`, `ux-audit.spec.ts`, `ux-edge-states.spec.ts`, `ux-interactions.spec.ts`, `ux-fixture.ts`, `ux-navigation.ts` |
| Documentation/evidence | `README.md`, `docs/mobile-layout/validation.md` (historical marker), this directory's audit, measurements and screenshots |

No engine, rules, server, authentication-provider, database, dependency, deployment or native configuration changes are required.

## Layout and physical limits

One landscape-oriented composition is used throughout. The fixed shell measures the real visual viewport and safe insets. Long information uses focused sections, pagination and short forms instead of document scrolling. Inputs stay mounted and values survive keyboard-sized viewport changes. No global CSS rotation or portrait-specific redesign was added.

Native iPhone/iPad settings retain Landscape Left/Right and full screen; Android retains `sensorLandscape`. The PWA manifest still requests landscape, and the existing one-time supported orientation-lock request is preserved. **iOS Home Screen apps cannot reliably override system Portrait Orientation Lock.** If the OS remains portrait, the same composition is constrained into that viewport; enable rotation for the intended experience. Native orientation settings are not a promise of forced PWA rotation.

Measured 30-card strips expose at least 18px at the seven supported landscape sizes. These are smaller than 44px primary action buttons. The conservative 104-card fixture exposes roughly 5–6px per card at the smallest landscape size: coordinate-based selection remains distinct and the inspection line makes the focused identity readable, but normal real-finger accuracy and simultaneous corner legibility are physically impossible to promise at that density. No card-count rule or artificial limit was introduced. Real devices, accessibility text sizes and very small split-screen windows still need evaluation.

## Validation

Final checks completed in this environment:

| Check | Result |
| --- | --- |
| Strict TypeScript and Vite production build | Passed |
| Vitest | 216 tests in 16 files passed |
| Browser coverage | 163 current cases have passing results across full and focused runs |
| Final screen/account/activity/multiplayer regression run | 60 passed |
| Final gameplay/layout and reconnect-lobby run | 20 passed |
| Final account-text bounds and refreshed audit run | 10 passed |
| Final screenshot evidence | 45 before/after pairs plus 8 additional Android/edge captures; all 45 measured screens have no document overflow or out-of-viewport controls |
| Capacitor sync | iOS and Android passed |
| Native orientation configuration | Landscape Left/Right on iPhone/iPad, full screen; Android sensorLandscape retained |
| Worker bundle | Deployment dry run passed |

The full browser run passed 160 of 161 cases. Its remaining assertion assumed a seven-card desktop hand always occupied one row; an opening 7 can automatically grow it to nine cards, correctly producing two existing desktop rows. The assertion now checks the actual card count. The subsequent 60-case run passed, including that real-room case and two new edge-state tests. Final visual inspection prompted two additional fixes: short-screen reconnect banners and penalty button sizing (20-case run passed), then consistent account label/value columns with explicit text bounds (10-case run passed). The 163-case figure is coverage across these runs, not a claim of one clean 163-case invocation.
 Browser tests use Linux Chromium with touch, iPhone-like/Android-like user agents and deterministic mock accounts; they are **not physical iOS Safari or Android device tests**. Supabase provider-dependent account/career screens use fixtures. Real guest rooms, sockets and gameplay run against the actual local Worker.

The viewport matrix covers 667×375, 800×360, 844×390, 852×393, 915×412, 932×430 and 960×432. Coverage includes 2/4/8-player tables, single-row 7/10/15/20/25/30-card selections, extreme hands through 104, matching selection, every action phase, safe insets, animations, reduced motion, timeout/reconnect, results, dialogs, navigation, forms and keyboard-sized viewports. A complete iPhone-like host/Android-like peer guest journey plays a real match to results, leaves the room, then explicitly switches to the registered-account fixture for profile/statistics/history/buddy/ranking navigation.

```sh
npm run typecheck
npm test -- --maxWorkers=2
npm run build
PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --workers=1
npx cap sync ios
npx cap sync android
npx wrangler deploy --dry-run --outdir /tmp/least-count-mobile-ux-worker
```

To regenerate final captures only, run the audit spec after a production build. The baseline was generated with `UX_AUDIT_PHASE=before` on the old application; do not overwrite it with current UI. Screenshots use fixtures and expose no production player data.

## Before and after

All pairs below use the same 667×375 touch viewport. [After measurements](after/bounds.json) accompany screenshots; real control bounds/tap/occlusion checks supplement visual review.

| Existing screen/state | Before | After |
| --- | --- | --- |
| account | [Before](before/account.jpg) | [After](after/account.jpg) |
| activity | [Before](before/activity.jpg) | [After](after/activity.jpg) |
| activity history | [Before](before/activity-history.jpg) | [After](after/activity-history.jpg) |
| buddies | [Before](before/buddies.jpg) | [After](after/buddies.jpg) |
| buddy search | [Before](before/buddy-search.jpg) | [After](after/buddy-search.jpg) |
| callback error | [Before](before/callback-error.jpg) | [After](after/callback-error.jpg) |
| create | [Before](before/create.jpg) | [After](after/create.jpg) |
| dashboard | [Before](before/dashboard.jpg) | [After](after/dashboard.jpg) |
| disconnected | [Before](before/disconnected.jpg) | [After](after/disconnected.jpg) |
| game results | [Before](before/game-results.jpg) | [After](after/game-results.jpg) |
| guest | [Before](before/guest.jpg) | [After](after/guest.jpg) |
| hand 15 | [Before](before/hand-15.jpg) | [After](after/hand-15.jpg) |
| hand 25 | [Before](before/hand-25.jpg) | [After](after/hand-25.jpg) |
| hand 30 | [Before](before/hand-30.jpg) | [After](after/hand-30.jpg) |
| hand 7 | [Before](before/hand-7.jpg) | [After](after/hand-7.jpg) |
| history report | [Before](before/history-report.jpg) | [After](after/history-report.jpg) |
| history round | [Before](before/history-round.jpg) | [After](after/history-round.jpg) |
| join | [Before](before/join.jpg) | [After](after/join.jpg) |
| leaderboards | [Before](before/leaderboards.jpg) | [After](after/leaderboards.jpg) |
| least | [Before](before/least.jpg) | [After](after/least.jpg) |
| loading | [Before](before/loading.jpg) | [After](after/loading.jpg) |
| lobby 8 | [Before](before/lobby-8.jpg) | [After](after/lobby-8.jpg) |
| opponent | [Before](before/opponent.jpg) | [After](after/opponent.jpg) |
| power seven | [Before](before/power-seven.jpg) | [After](after/power-seven.jpg) |
| practice setup | [Before](before/practice-setup.jpg) | [After](after/practice-setup.jpg) |
| profile | [Before](before/profile.jpg) | [After](after/profile.jpg) |
| profile buddies | [Before](before/profile-buddies.jpg) | [After](after/profile-buddies.jpg) |
| profile edit | [Before](before/profile-edit.jpg) | [After](after/profile-edit.jpg) |
| profile game history | [Before](before/profile-game-history.jpg) | [After](after/profile-game-history.jpg) |
| profile photo error | [Before](before/profile-photo-error.jpg) | [After](after/profile-photo-error.jpg) |
| profile statistics | [Before](before/profile-statistics.jpg) | [After](after/profile-statistics.jpg) |
| profile unsaved | [Before](before/profile-unsaved.jpg) | [After](after/profile-unsaved.jpg) |
| public profile | [Before](before/public-profile.jpg) | [After](after/public-profile.jpg) |
| rank buddies | [Before](before/rank-buddies.jpg) | [After](after/rank-buddies.jpg) |
| rank global | [Before](before/rank-global.jpg) | [After](after/rank-global.jpg) |
| recovery | [Before](before/recovery.jpg) | [After](after/recovery.jpg) |
| replacement | [Before](before/replacement.jpg) | [After](after/replacement.jpg) |
| reset request | [Before](before/reset-request.jpg) | [After](after/reset-request.jpg) |
| round results | [Before](before/round-results.jpg) | [After](after/round-results.jpg) |
| rules | [Before](before/rules.jpg) | [After](after/rules.jpg) |
| settings | [Before](before/settings.jpg) | [After](after/settings.jpg) |
| sign in | [Before](before/sign-in.jpg) | [After](after/sign-in.jpg) |
| sign up | [Before](before/sign-up.jpg) | [After](after/sign-up.jpg) |
| startup error | [Before](before/startup-error.jpg) | [After](after/startup-error.jpg) |
| table options | [Before](before/table-options.jpg) | [After](after/table-options.jpg) |

Additional Android-like 915×412 captures: [dashboard](after/android-dashboard.jpg), [7 cards](after/android-hand-7.jpg), [15 cards](after/android-hand-15.jpg), [25 cards](after/android-hand-25.jpg), [30 cards](after/android-hand-30.jpg), [table options](after/android-table-options.jpg).

Additional edge-state captures: [career services disabled](after/career-disabled.jpg) and [long activity detail](after/activity-detail.jpg).

## Next device checks

Install the reviewed web build from Safari/Chrome, inspect both landscape directions and cutouts, exercise real keyboard open/close, photo selection/errors, dense-hand finger selection, background/reconnect, result paging and accepting updates outside live play. Verify real email confirmation/recovery and career tracking against the configured project. Xcode/iOS SDK and Android SDK are unavailable here, so native compilation and device execution are not validated; Capacitor sync and orientation configuration checks cannot establish store readiness.
