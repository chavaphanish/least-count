---
name: yaydu-design-system
description: Use when editing YAYDU branding, visual styling, typography, colors, cards, buttons/icons, shared UI components, responsive panels or animations; preserve the existing design rather than creating unrelated variants.
---

# YAYDU design-system workflow

Read [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md) and the terminology/scope rules in [AGENTS.md](../../../AGENTS.md). For orientation or hand geometry also load [mobile UI skill](../yaydu-mobile-ui/SKILL.md).

1. Find the owning component and scoped CSS; inspect import order in [main.tsx](../../../src/main.tsx). Reuse tokens from [styles.css](../../../src/styles.css) and [mobile-tokens.css](../../../src/mobile-tokens.css) instead of inventing a gold shade, spacing system or font.
2. Preserve original logo artwork/aspect ratio and established DM Sans/Libre Caslon roles. Distinguish header branding from [DualBrand](../../../src/components/DualBrand.tsx) loading/transition/rotation compositions; do not change both for a one-screen task.
3. Reuse Avatar/PlayerIdentity, `xpProgress()`, PlayingCard/AdaptiveHand, TurnActions, TableOverlay and existing list/tab patterns as appropriate. Preserve handlers, auth/state ownership and card values during visual changes.
4. Match the affected group's background/border/type/dimensions and hover/pressed/focus/disabled states. Existing Lounge featured/dark variants are intentional; uniform gameplay gold does not authorize restyling unrelated actions.
5. Use YAYDU/Lounge/Drop/Declare Least/Round Joker/Host a game/My Profile for new or requested copy. Keep legacy routes, component names, event strings and existing out-of-scope labels stable.
6. Validate accessible icon labels, focus and contrast, long names, touch sizing, reduced motion and mobile landscape fit with [testing skill](../yaydu-testing/SKILL.md). Avoid an exhaustive visual audit for a small change.

Complete when requested visual behavior is consistent with shared tokens/components and existing functionality remains intact. Report relevant desktop/mobile checks and any physical-device limits; do not introduce dependencies or unrelated redesigns.
