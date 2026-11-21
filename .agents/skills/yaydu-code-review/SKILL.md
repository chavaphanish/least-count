---
name: yaydu-code-review
description: Use before committing/releasing YAYDU changes or when asked to review a diff/PR; check game-state regressions, privacy/security, performance, unnecessary complexity, missing tests and repository/workflow compliance.
---

# YAYDU code review workflow

Read [AGENTS.md](../../../AGENTS.md), then inspect `git status`, the intended base and actual diff. Load only relevant [architecture](../../../ARCHITECTURE.md), [game rules](../../../GAME_RULES.md), [design system](../../../DESIGN_SYSTEM.md) or specialist skills.

1. Confirm scope and classify risk. Preserve unrelated edits; do not review only the last commit if the task spans several. Check docs-only claims against changed paths, and check the single version bump/changelog/Git workflow for implementations.
2. Trace changed behavior through its authority and consumers. Look for wrong phase/actor/host checks, timing extensions, duplicate penalties/actions, lost selections, stale state or legacy-save incompatibility. Verify confidentiality in projections, events, errors and logs.
3. Review server origin/token validation, RLS/grants, credentials, destructive operations and data-preservation boundaries. UI hiding is not authorization; an empty test failure log is not security evidence.
4. Inspect performance/lifecycle effects: duplicate timers, listeners, API calls, socket reconnect loops, unbounded state/history, missing cleanup and hidden-tab/rotation behavior. Prefer existing shared utilities and scoped styles over needless abstractions or refactors.
5. Ensure regressions are tested at the correct layer using [testing skill](../yaydu-testing/SKILL.md). Check test assertions actually exercise the failure and document mock/physical/live limits. Report stale selectors and unrun checks; never manufacture passing results.
6. Run `git diff --check`. For PRs, inspect exact head/checks and obey protections. Merge/push/deploy only within authorization; do not bypass required checks, rewrite history or claim a build/upload is active production.

Complete with concrete findings (severity, file and practical impact), fixes made and verification. If no issues are found, state that with tested limits; do not invent findings. Instructions-only work must leave runtime/config/dependencies/version unchanged, apart from explicitly requested documentation.
