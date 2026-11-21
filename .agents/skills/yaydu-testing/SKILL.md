---
name: yaydu-testing
description: Use to select and execute focused YAYDU unit, SQL integration, Worker or Playwright browser checks; add regressions for game/auth/multiplayer/mobile behavior; validate documentation without unnecessary full suites.
---

# YAYDU testing workflow

Read [AGENTS.md](../../../AGENTS.md), [package scripts](../../../package.json), [Vite/Vitest config](../../../vite.config.ts) and [Playwright config](../../../playwright.config.ts) as needed. Work from the repository root; use existing commands, not an invented lint or CI script.

1. Map changed behavior to authority/consumers and pick the smallest meaningful checks. Add regression assertions for a failure mode, not a duplicate of implementation details. Mock provider responses with existing fixtures, never production accounts/secrets.
2. Existing command examples (select relevant files):

```sh
npm test -- src/game/engine.test.ts src/game/opening.test.ts
npm test -- server/room.test.ts server/objects.test.ts server/host-transfer.test.ts
npm test -- server/auth.test.ts server/access.test.ts server/identity-db.test.ts
npm test -- server/career-db.test.ts server/account-erasure-db.test.ts
npm test -- src/presentation/handLayout.test.ts src/presence/client.test.ts server/presence.test.ts
npm run typecheck
npm run build
```

`npm run build` already includes `tsc -b`; do not repeat typechecking/building without a reason. PGlite suites exercise SQL/roles locally, not live Supabase.

3. For changed UI, build once for final production validation, then select specs:

```sh
PLAYWRIGHT_PREVIEW=1 npx playwright test e2e/viewport-startup.spec.ts e2e/orientation-guard.spec.ts
PLAYWRIGHT_PREVIEW=1 npx playwright test e2e/opening.spec.ts e2e/multiplayer.spec.ts
PLAYWRIGHT_PREVIEW=1 npx playwright test e2e/signup.spec.ts e2e/header-navigation.spec.ts
```

Playwright starts local Worker (8787) and Vite/preview (5173/4173). Install Chromium with `npx playwright install chromium` only if needed. On compatible Linux, `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` selects a present system binary; it is not a cross-platform default. See [README setup](../../../README.md). Use `--grep` to target cases when appropriate.

4. Critical checks include rejected immutable game actions, scoring/forfeit exactly once, request deduplication, hidden-card projection, token/owner access, round/connection restoration, mobile viewport/keyboard/hand fit and state/deadline preservation. Use [existing fixtures](../../../e2e/career-fixture.ts) and capture device/origin/version details for real-device bugs.
5. Report command/results accurately. Older browser selectors may be stale; distinguish fixture/selector failures from a regression and repair only the relevant tests. Never silently skip failures or claim the full suite passed from a focused run.
6. Documentation-only validation: parse all skill YAML frontmatter, check links/source symbols/commands, compare documented rules to code, inspect `git diff --check` and ensure no runtime/config/dependency changes. Do not build/sync/deploy the app merely to validate Markdown.

Complete with executed commands, results, failures/blockers and untested boundaries. Emulated rotation/provider mocks/Capacitor sync do not prove physical iOS, email delivery, deployed RLS/secrets or native compilation. Broad suites are warranted by broad/high-risk changes, not every edit.
