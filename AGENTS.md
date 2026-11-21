# YAYDU repository instructions

## Scope and reading order

Apply these rules automatically to YAYDU development without reminders. Preserve other applicable repository instructions and follow explicit task overrides. Read only the references and skills relevant to the task; do not load every skill for a small change.

- [Architecture and source map](ARCHITECTURE.md): implementation boundaries, security and known documentation gaps.
- [Implemented game rules](GAME_RULES.md): verified behavior and rule-reference precedence.
- [Design system](DESIGN_SYSTEM.md): existing tokens, components and mobile constraints.
- [README](README.md): setup and commands. [ChangeLog](ChangeLog.md): release history. [TODOS](TODOS.md): backlog, not proof that a feature is absent or complete.

## Permanent versioning and Git workflow

Automatically classify each implementation task by its highest-impact change. Follow Semantic Versioning (`MAJOR.MINOR.PATCH`). These rules replace the earlier patch-only policy and conflicting historical delivery notes; preserve historical release entries and useful instructions.

| Classification | Scope | Version increment | Git workflow |
| --- | --- | --- | --- |
| **PATCH — small changes** | Bug fixes, styling adjustments, and minor improvements. | Increment PATCH only: `1.2.3 → 1.2.4`. | Commit directly to the current working branch. Do not create a PR. |
| **MINOR — medium changes** | New features, moderate functionality changes, and significant UI improvements. | Increment MINOR and reset PATCH: `1.2.3 → 1.3.0`. | Create a dedicated branch and a PR. |
| **MAJOR — major upgrades** | Major redesigns, architectural changes, breaking changes, and substantial upgrades. | Increment MAJOR and reset MINOR and PATCH: `1.2.3 → 2.0.0`. | Create a dedicated branch and a PR. |

- Update all applicable version references and `ChangeLog.md`. `package.json` supplies the web version; keep the lockfile synchronized. See [release skill](.agents/skills/yaydu-release/SKILL.md) for native-version boundaries.
- Never bump more than once per implementation task. Follow-up fixes, validation and additional commits within that task use its version.
- Documentation/instructions-only maintenance does **not** bump the application version.
- Use descriptive commit messages. Never push MINOR or MAJOR work directly to `main`.
- Respect branch protections and required checks; never bypass them. A release is not deployed merely because it built or a PR merged: verify the exact production commit's deployment before claiming success.

## Development principles

- Make minimal, targeted changes; preserve functionality outside the requested scope.
- Reuse components, utilities, handlers and architectural patterns before adding new ones. Avoid duplication, unnecessary dependencies and unrelated refactoring.
- Keep error handling consistent with existing `ServiceError`, `ApiError` and `RuleError` boundaries; preserve useful logs without leaking credentials, tokens, hidden cards or sensitive user data.
- Never place privileged credentials in Git, chat, browser bundles or `VITE_*` variables. Preserve runtime secret bindings during deployment.

## Mobile and PWA

- Mobile is landscape-only. The shared portrait guard must cover every route, including startup and authentication, with content hidden/inert while controllers remain mounted. Desktop remains unrestricted.
- Fit essential content within landscape viewports without page-level scrolling. Preserve deliberate vertical list/overlay scrolling where already supported; no horizontal hand scrolling, pagination or extra hand rows.
- Reuse `MobileOrientation`, `AdaptiveHand`, viewport variables and safe-area tokens. Handle startup, rotation, keyboard and standalone lifecycle centrally rather than adding per-page positional fixes.
- Preserve responsive sizes, selection readability, performance, smooth animations and reduced-motion behavior.
- Physical-device behavior is not proven by browser emulation. The first-rotation iPhone issue [#63](https://github.com/chavaphanish/least-count/issues/63) remains open despite v1.1.37/v1.1.38 simulations passing; do not claim it fixed without affected-device evidence.

## Game integrity

- Preserve [established rules](GAME_RULES.md); never alter them without explicit instructions. If intended rules and implementation differ, record the discrepancy instead of silently choosing new behavior.
- Validate moves and scores against authoritative state. Preserve actor/host authorization, request deduplication, deadlines, atomic persistence and race handling.
- Preserve hidden hands and Draw Pile order. Use the public room projection; never serialize authoritative state to clients or public logs.
- Handle disconnection, reconnection, timeout forfeits, score elimination and host handover without resetting state or charging penalties twice.

## Database and security

- Protect existing authentication, recovery, authorization and owner-access patterns; validate sensitive operations server-side.
- Preserve account IDs, names, statistics, XP, friendships and history. Never delete/reset production data without explicit authorization.
- Use reviewed, additive/reversible migrations where possible. Explain irreversibility and dependencies when unavoidable; do not rewrite deployed migrations as a substitute for a new migration.
- Maintain RLS, function grants, explicit `search_path` and privileged-service boundaries. Verify live configuration separately from SQL/provider mocks; follow the existing rollout guides.

## Testing and quality

- Run relevant checks before committing. Add/update meaningful regression tests when behavior changes, prioritizing scoring, multiplayer, authentication and game-state preservation.
- Scale checks to the change; avoid exhaustive suites for trivial work. Documentation-only changes need link/frontmatter/source/diff checks, not an application build by default.
- Report failed, skipped and unexecuted checks honestly. Do not claim mock provider tests, Chromium simulations or native synchronization prove live services, physical PWA behavior or native compilation.
- Consult [testing skill](.agents/skills/yaydu-testing/SKILL.md) for existing commands and test selection; there is no lint script.

## Branding and terminology

Use these player-facing terms in new or explicitly requested text changes:

| Use | Avoid |
| --- | --- |
| YAYDU | YAYDO |
| Lounge | Dashboard |
| Drop | Discard |
| Declare Least | Declare Show |
| Round Joker | Selected Joker |
| Host a game | Create Game Room |
| My Profile | Player Profile |

Preserve the logos, golden/dark-green theme, typography and component styling. Keep `least-count`, internal identifiers (`DashboardPage`, `discard`, `show`), API routes, schemas and storage keys unchanged unless their modification is necessary and authorized. Some current labels still differ (notably **Create Game Room**); this documentation task does not rename them or authorize a blanket UI rewrite.

## Load relevant skills on demand

| Work | Repository skill |
| --- | --- |
| Version, changelog, commits, branch/PR/release | [yaydu-release](.agents/skills/yaydu-release/SKILL.md) |
| Landscape, safe areas, PWA, hand sizing | [yaydu-mobile-ui](.agents/skills/yaydu-mobile-ui/SKILL.md) |
| Card rules, scoring, turn transitions | [yaydu-game-engine](.agents/skills/yaydu-game-engine/SKILL.md) |
| Rooms, sockets, presence, host transfer | [yaydu-multiplayer](.agents/skills/yaydu-multiplayer/SKILL.md) |
| Supabase, identity, careers, migrations | [yaydu-database](.agents/skills/yaydu-database/SKILL.md) |
| Selecting and running validation | [yaydu-testing](.agents/skills/yaydu-testing/SKILL.md) |
| Branding, controls, cards, shared styles | [yaydu-design-system](.agents/skills/yaydu-design-system/SKILL.md) |
| Focused correctness/security review | [yaydu-code-review](.agents/skills/yaydu-code-review/SKILL.md) |
