---
name: yaydu-mobile-ui
description: Use for YAYDU mobile landscape layouts, adaptive hands, safe-area or keyboard sizing, orientation changes, installed iOS/Android PWA startup/lifecycle bugs, and mobile UI regression checks.
---

# YAYDU mobile UI workflow

Load [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md) and the mobile section of [ARCHITECTURE.md](../../../ARCHITECTURE.md), then only the affected components/styles.

1. Identify device/browser/OS, installed versus tab mode, app version, orientation sequence and affected region. For the unresolved first-rotation bug, read [issue #63](https://github.com/chavaphanish/least-count/issues/63) and its original screenshots; do not assume the previous patches fixed physical iPhones.
2. Inspect [MobileOrientation](../../../src/components/MobileOrientation.tsx), [app-mobile.css](../../../src/app-mobile.css), [mobile.css](../../../src/mobile.css), and the relevant scoped stylesheet. Use one measured viewport/origin/keyboard/safe-area contract; do not add per-page offset guesses or duplicate orientation listeners.
3. Preserve the portrait guard's hidden/inert content and mounted controllers. Keep [PWA manifest](../../../public/manifest.webmanifest) and native landscape settings; no rotation hacks or auth/game/socket resets.
4. For hands, reuse [AdaptiveHand](../../../src/components/AdaptiveHand.tsx) and [layoutHand](../../../src/presentation/handLayout.ts). Check 7/15/25 cards and relevant larger counts, preserving rank/suit artwork, selection and hit targets without horizontal scrolling or extra rows.
5. Test relevant desktop and mobile landscape sizes, portrait → landscape on first launch, resize/keyboard recovery, safe-area cutouts, selected cards, deadlines and overlays. Preserve deliberate internal list scrolling; prevent page-level overflow.
6. Use the focused commands in [testing skill](../yaydu-testing/SKILL.md), especially viewport-startup, orientation-guard, gameplay-layout, fixed-table or Android specs as appropriate. Real-device captures need real measurements, not just overridden Chromium properties.

Complete when the requested layout change is scoped, accessibility/state preservation and overflow are checked, and emulation versus physical-device results are distinguished. Record unresolved device behavior instead of promising a hardware fix from simulations.
