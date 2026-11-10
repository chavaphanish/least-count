# Mobile fixed-screen validation

The implementation was checked in Linux Chromium with iPhone/Android user-agent, touch and viewport emulation. Captures in this directory use mock/local test data, not private production hands.

| Check | Result |
| --- | --- |
| TypeScript validation and Vite production build | Passed |
| Vitest | 216 tests in 16 files passed |
| Browser regression coverage | 146 distinct current cases covered with passing final results across full and focused runs |
| Final application/maximum-hand acceptance run | 22 passed |
| Final animation regression run | 5 passed |
| Capacitor synchronization | iOS and Android passed |
| Native orientation configuration | iPhone/iPad Landscape Left/Right and full-screen setting, Android sensorLandscape validated |
| Worker deployment bundle | Dry run passed |

The last full browser run passed 144 of 145 cases. Its remaining lobby assertion ran immediately after resizing, before React committed the new visual viewport. The test now waits for the shell dimensions before measuring controls. The subsequent 22-case acceptance run passed, including the lobby at every requested size, actual reduced-visual-viewport keyboard bounds, and all 104 cards in landscape and portrait. An additional 146th case exposed a replacement-flight destination measured before the hand expanded; final-slot tracking fixed it, and all five affected animation checks passed. These results are coverage across runs, not a claim of a single clean 146-case invocation.

## Viewports and interactions

The landscape matrix covers 667×375, 800×360, 844×390, 852×393, 915×412, 932×430 and 960×432. It traverses access modes, dashboard, Create/Join, profiles, all statistic groups, game history/reports, public profiles, global/buddy rankings, buddy sections, settings and rules. Loading/retry and eight-seat lobbies are also checked.

Pure geometry tests cover every hand count through the conservative 104-card deck bound. Browser cases exercise 1/7/10/15/20/25/30/44/104 cards. Tests measure actual rectangles and exposed hit regions, tap every card individually in the stress hand, verify selection/deselection, check that no card is occluded at its identifying corner, and confirm matching selection/state survive resizing. The maximum hand is hit-tested at all seven landscape sizes and in the portrait fallback. The 14→15 replacement regression compares the animated destination with the final hand slot and verifies the accepted state remains unchanged through animation.

Keyboard checks use a 170px visual viewport and assert input, action and verification-message bounds against that reduced surface. They cover email registration, Create/Join, buddy search, profile editing and password recovery. Viewport restoration and retained field values are checked. Existing live multiplayer checks cover synchronized actions, reconnect/resume, socket preservation on rotation and server timeout continuation.

## Visual review

Reviewed: [loading](loading.png), [sign in](sign-in.png), [dashboard](dashboard.png), [create](create-game.png), [eight seats](lobby-8.png), [7 cards](hand-7.png), [15 cards](hand-15.png), [25 cards](hand-25.png), [104 cards](hand-104.png), [portrait fallback](hand-104-portrait.png), [Power Card 7](power-seven.png), [Declare Least](declare-least.png) and [activity](activity.png).

The conservative maximum-hand fixture concentrates the available deck into one hand to stress presentation. Other players' empty hands in that fixture are not a new gameplay rule. Dense targets retain at least 20×28px exposed regions in tested landscape areas, smaller than ordinary 44px primary controls.

## Remaining device work

Physical iPhone/Android Home Screen orientation, real virtual keyboards, accessibility text settings, cutouts and finger accuracy at extreme density still need device checks. iOS PWAs cannot reliably override Portrait Orientation Lock; the responsive portrait fallback stays usable without an instruction blocker. CSS virtual rotation is omitted because the OS keyboard, top-layer dialogs and measured touch/animation coordinates do not safely rotate together.

Native compilation and device execution were unavailable in this Linux environment: Xcode and the Android SDK are required. Synchronization and static orientation validation do not establish store readiness or complete native backend integration. See the README's Mobile Development boundary.
