# YAYDU design system

Describe and reuse the existing interface; this reference does not authorize redesign. [AGENTS.md](AGENTS.md) governs terminology and scope, and [ARCHITECTURE.md](ARCHITECTURE.md) maps source ownership.

## Brand and typography

- Product: **YAYDU**, tagline **The Game of Sevens**; studio: **Chavium Games**. Keep technical `least-count` names unchanged.
- [src/styles.css](src/styles.css) imports local font packages: DM Sans 400/500/600/700 for UI/wordmarks, Libre Caslon Display 400 for editorial/display headings. Do not introduce a replacement font for a small task.
- [StudioLogo](src/components/StudioLogo.tsx), [HeaderBrand](src/components/HeaderBrand.tsx) and [DualBrand](src/components/DualBrand.tsx) own branding placements; [branding.css](src/branding.css) scopes header versus shared loading/transition/rotation presentation.
- Artwork lives in [public/branding/](public/branding/) and [assets/branding/](assets/branding/). Preserve supplied geometry/aspect ratios. Follow [branding asset notes](assets/branding/README.md) before regenerating icons; do not redraw or distort the 7/spade symbol.
- Dual-brand compositions match complete visible logo heights, excluding Powered by and near-invisible export padding. Three artwork layers share gold progress fill; changing header branding must not accidentally change these compositions.

## Existing tokens

Root tokens in `src/styles.css`:

| Token/role | Value |
| --- | --- |
| `--gold` | `#e9cd91` |
| `--cream` / default text | `#f4f0df` |
| `--muted` | `#b7c9ba` |
| `--border` | `#bdd2b52b` |
| Base background | `#0c2e26` |

[mobile-tokens.css](src/mobile-tokens.css) provides 4/8/12/16/24px spacing, a 12px UI radius, 36px control/44px action tokens, 13px body, 11px captions and 26px title tokens. Existing component overrides vary intentionally; reuse the relevant component rather than forcing every screen to one radius or size. Raised/panel colors include `#1c4d3d` and `#103e32d9`. Existing felt surfaces may use subtle gradients; do not introduce arbitrary new accents or blanket-remove established styling.

## CSS ownership and layout

[src/main.tsx](src/main.tsx) imports shared styles, mobile rules/tokens, app-mobile, gameplay, branding, auth, career and Lounge CSS in order. Later scoped rules can override earlier ones; inspect specificity before adding a fix.

- [styles.css](src/styles.css): baseline type, buttons, cards, header and desktop UI.
- [mobile.css](src/mobile.css): mobile safe-area tokens, overlays, portrait guard.
- [app-mobile.css](src/app-mobile.css): shared mobile shell, visible viewport origin/dimensions, keyboard and screen sizing.
- [gameplay-layout.css](src/gameplay-layout.css): table, hand/action/status regions.
- [auth/access.css](src/auth/access.css), [auth/signed-out-lounge.css](src/auth/signed-out-lounge.css): auth forms and signed-out layout.
- [pages/lounge.css](src/pages/lounge.css): authenticated Lounge only; do not alter the shared header through Lounge selectors.
- [career/leaderboard.css](src/career/leaderboard.css), [career/circle.css](src/career/circle.css), [settings-panel.css](src/components/settings-panel.css): compact list/tabbed panels.

Authenticated header: profile/avatar/identity and XP progress at left; Home, trophy, Buddies, Mailbox, Settings navigation at right. Signed-out header has branded text/tagline and Home only. [Layout](src/components/Layout.tsx) owns it; do not recreate a header per page. The Lounge has a welcome area and 2×2 actions; Tutorial opens the guided practice round. **Host a Game** creates a room directly; host-only settings live in the waiting lobby.

## Reusable UI components

| Need | Reuse |
| --- | --- |
| Avatar, initials, online dot | [Avatar](src/components/Avatar.tsx) with shared presence provider |
| Real name + @username, compact/full identity | [PlayerIdentity](src/components/PlayerIdentity.tsx), [identity formatter](src/shared/playerIdentity.ts); inspect the career adapter where relevant |
| Header profile/XP | [HeaderProfile](src/components/HeaderProfile.tsx), [CareerGlance](src/career/CareerGlance.tsx), shared [xpProgress](src/career/model.ts) |
| Card artwork/selection | [PlayingCard](src/components/PlayingCard.tsx), [PlayerHand](src/components/PlayerHand.tsx) |
| Complete overlapping hand | [AdaptiveHand](src/components/AdaptiveHand.tsx), [layoutHand](src/presentation/handLayout.ts) |
| Phase-specific controls | [TurnActions](src/components/TurnActions.tsx), existing handlers and `.button-primary` |
| Modal, focus containment | [TableOverlay](src/components/TableOverlay.tsx), native dialog patterns used by validation/guest/deletion/host-transfer dialogs |
| Compact forms | [CompactForm](src/components/CompactForm.tsx), [IdentityFields](src/components/IdentityFields.tsx), [PasswordField](src/components/PasswordField.tsx) |
| Activity/results | [GameActivity](src/components/GameActivity.tsx), [RoundSummary](src/components/RoundSummary.tsx), [ResultScores](src/components/ResultScores.tsx) |

## Buttons, icons and accessibility

Use existing `.button`, `.button-primary`, `.text-button`, `.header-icon` and scoped screen variants. Gameplay actions share the primary gold family; Lounge action cards intentionally have a featured gold card and darker siblings. Preserve each group's existing height, padding, radius and hover/pressed/focus/disabled states. Avoid global style changes for a single button.

Header/action icons are inline SVGs using `currentColor`, established stroke weights and sizing classes; decorative SVGs are `aria-hidden`. Icon-only controls need accessible labels/tooltips and current-page indication. Keep native button/link semantics, visible keyboard focus, disabled behavior and comfortable touch targets. Long names need accessible full identity even when visible text is compact.

Native modal dialogs provide focus containment/inert background behavior. `TableOverlay` defaults to Close and allows an OK dismissal label for Tutorial; do not change all callers to suit one popup. Preserve clear validation/errors and restore usable focus after dismissal.

## Mobile and PWA contract

[MobileOrientation](src/components/MobileOrientation.tsx) centrally detects mobile/portrait, keeps controllers mounted, exposes measured `--app-width`, `--app-height`, `--app-left`, `--app-top`, and shows the full-screen portrait guard. Mobile fixed descendants share the visual viewport through the content wrapper. Keep the manifest/native landscape configuration; no CSS rotation hacks or per-screen offsets.

- Essential UI fits the actual visible landscape viewport, including keyboard transitions and safe-area insets; preserve deliberately scrollable lists/history rather than page scrolling.
- The complete hand remains one adaptive row with overlap and selection lift, not horizontal scrolling/pagination. Inspect exposed hit regions and rank/suit readability at 7, 15 and 25 cards; larger supply-bound cases are covered by layout tests.
- Respect `env(safe-area-inset-*)`, the shared viewport context and `[data-keyboard]`; do not duplicate detection or use only `100vh` to fix an iPhone.
- Test desktop plus representative 844×390, 667×375 and 480×320 landscape sizes, both rotation directions, keyboard appearance and selected cards. These are test sizes, not proof of every device.
- The physical iPhone first-rotation content-height discrepancy remains [open #63](https://github.com/chavaphanish/least-count/issues/63). Retain the screenshot evidence and capture real measurements before claiming another fix.

## Motion and feedback

[TurnAnimation](src/components/TurnAnimation.tsx) and [useRoomCardMotion](src/hooks/useRoomCardMotion.ts) follow confirmed card changes; hidden draws remain face down. [LoadingScreen](src/components/LoadingScreen.tsx), [NavigationLoading](src/components/NavigationLoading.tsx) and DualBrand handle covers without remounting gameplay or extending deadlines. Preserve existing reduced-motion rules.

[src/feedback/](src/feedback/) owns device-local sound/haptic/turn-notification settings and deduplicated cues. Reuse it rather than adding event listeners or audio timers to individual buttons. Unsupported vibration/autoplay behavior must not prevent play. No cosmetic change should change authoritative action timing.
