---
name: yaydu-game-engine
description: Use for YAYDU card values, turn sequencing, Drop/Draw/open pickup, 7 stacking, Printed/Round Jokers, Declare Least, scoring, timeout forfeits, elimination, exhaustion or game-rule regression work.
---

# YAYDU game engine workflow

Read [GAME_RULES.md](../../../GAME_RULES.md), then relevant [current amendments](../../../docs/RULEBOOK.md) and [confirmed decisions](../../../docs/rule-clarifications.md). The archived draft is subordinate where conflicting. Never change rules without explicit direction.

1. Trace the reported action/phase in [engine.ts](../../../src/game/engine.ts) and [deck.ts](../../../src/game/deck.ts). Reproduce with explicit physical card IDs, player/score/phase/eligible IDs, deadline and deterministic time/randomness.
2. Keep engine validation authoritative and immutable on rejection. Review `inspectDiscard`, `pickupCards`, `applyAction`, `settle`, `beginTurn` and forced/legacy transitions as relevant, rather than hiding an illegal client control.
3. Protect invariants: one same-rank owned group; no face-up 7 pickup; no replacement for 7/Match and Drop; only the immediately preceding eligible group; +2 per 7 action; full-cycle cancellation; closed-card confidentiality; deadlines not extended by animation or draw choice.
4. For scoring, distinguish hand total, round penalty, cumulative score and round winner. Preserve failed Least +40 only to caller, successful opponent cap 40, zero ties, uncapped exhaustion, exactly-once timeout forfeit and cutoff-based elimination. The implemented timer is 45 seconds, not a configurable arbitrary duration.
5. Add focused regressions in [engine.test.ts](../../../src/game/engine.test.ts), [opening.test.ts](../../../src/game/opening.test.ts) or [cards.test.ts](../../../src/game/cards.test.ts). Exercise invalid actions without input mutation, next-turn/round behavior, supply/recycling and relevant player counts.
6. If online state/projection is affected, inspect [server/room.ts](../../../server/room.ts) and use [multiplayer skill](../yaydu-multiplayer/SKILL.md). Run selected tests and the required final build per [testing skill](../yaydu-testing/SKILL.md).

Complete when the reproduction is fixed in shared authority, regression checks pass or blockers are reported, and only explicitly authorized rule documentation/behavior changed. Never turn ambiguous intended behavior into an invented new rule.
