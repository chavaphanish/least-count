# Mobile UX audit — baseline c2d32ef

This audit was recorded before application changes. `e2e/ux-audit.spec.ts` rendered 45 existing screens/states at 667×375 with iPhone/touch emulation, deterministic account/room/game fixtures and no production user data. Screenshots and control-bound measurements are in [before](before/bounds.json). The seven requested landscape sizes and Android configurations will be exercised after implementation. No physical-device testing is claimed.

## Findings and priorities

| Priority | Surface | Observed problem | Planned improvement |
| --- | --- | --- | --- |
| P0 | Round and match results | Eight scoring rows consume the fixed panel; the next-round/new-game button is outside the viewport. | Shared result layout with a persistent action region and paginated scores. |
| P0 | Disconnected lobby | The added connection alert consumes an implicit grid row and compresses player slots until labels overlap. | Explicit flexible connection-status region and stable two-row seat grid. |
| P0 | Full history and table options | Modal content requires internal scrolling; lower scores/actions are initially hidden. | Focused modal sections and explicit history/score pagination. |
| P1 | Hand | Thirty cards use two rows, contradicting the new single-row requirement. Seven-card layout reserves a narrow side action panel; some actions wrap to three lines. | Reusable single-row geometry for all counts; full-width hand with a separate adjacent action row. Dense hands get inspection feedback and documented touch-density limits. |
| P1 | Dashboard | Welcome name and player chip repeat identity; duplicate Profile/Settings links compete with Create/Join. Primary tiles leave large empty areas. | Player/XP rail, concise primary game tiles and one compact secondary menu. |
| P1 | Profile | Career/Settings/Account selector, profile tabs and subsection selector create three navigation levels before content. | Remove the outer selector from the normal career view; expose focused editing/account views with a clear return action. Retain all existing metrics. |
| P1 | Buddy management | Input aligns far right while Search sits on its own line at the left; the form takes excessive height. | Shared input/action alignment, focused search and consistent list actions. |
| P1 | Authentication | Sign-in action occupies half a row without a clear visual relationship to the fields; step navigation is disproportionately heavy. | Balanced entry composition, consistent primary controls, concise step navigation and preserved values/keyboard behavior. |
| P1 | Navigation | Buttons, links, selector arrows and modal close controls have inconsistent heights and placement. | Shared mobile spacing, control, type and radius tokens, clear Back/Close placement. |
| P2 | Loading and reports | Loading identity is disconnected from progress; reports mix oversized headings, dense prose and unstructured rows. | Compact identity/progress composition and consistent report cards/pagination. |
| P2 | Empty/error states | Empty rankings/buddy areas leave ambiguous space; reconnect text interrupts layout. | Consistent status surfaces with existing retry/return actions retained. |
| P2 | Orientation | Existing narrow-width media queries introduce distinct portrait layouts. | One landscape-oriented composition in either physical orientation; retain native landscape and one supported installed-PWA lock request. Document iOS OS-lock limits. |

## Scope decisions

- Google authentication is absent by prior user instruction. Audit verified-email, guest, recovery and existing callback states; do not reintroduce Google or fabricate unavailable screens.
- Preserve felt table, standard card art/backs, suits, colors, game rules, server authority, authentication security, career calculations and privacy.
- A single row cannot give 104 cards normal finger-sized targets on a phone. Test 7–30 cards with measured exposed corners and touch selection; retain all 104 representations in one row with inspection feedback and report the actual density. Do not claim physically comfortable independent tapping at that extreme.
- No global CSS rotation: it does not safely rotate OS keyboards, native dialogs or touch coordinates. Keep the same landscape composition without portrait-specific breakpoints; document that iOS Home Screen apps cannot reliably override system rotation lock.
- Superdesign CLI was checked and is unauthenticated. The redesign uses local browser inspection and existing assets without external generation credits or a new service login.

## Baseline evidence

Bounds identify off-screen result actions in both round and match results. Screenshots also show issues that bounds alone miss: disconnected-seat label collisions, multi-row hands, redundant identity, nested navigation, excessive blank space and internally scrolling dialogs.

Before/after pairs and final validation results will be added after implementation. This audit is the starting record, not a substitute for UI changes.
