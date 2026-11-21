# YAYDU — implemented game rules

This is a developer reference verified against the current shared engine, not authorization to change gameplay. The online Worker is authoritative; local practice runs the same engine in the browser. Read [current amendments](docs/RULEBOOK.md) and [confirmed decisions](docs/rule-clarifications.md) before the [archived working draft](RULEBOOK.md). Amendments/confirmed decisions supersede conflicting draft passages. If current code and an intended rule disagree, report it and obtain rule direction before changing behavior.

## Source map

- [Card primitives](src/game/cards.ts): ranks, suits and validated Fisher–Yates shuffle.
- [Deck and card values](src/game/deck.ts): deck supply, physical IDs, indicator selection, totals.
- [Shared engine](src/game/engine.ts): immutable transitions, eligibility, scoring and compatibility.
- [Room authority](server/room.ts): authenticated actors, manual start/next round, public projection.
- [Events](src/game/events.ts): public history; [bots](src/game/bot.ts) choose actions through existing rules.
- Tests: [engine](src/game/engine.test.ts), [opening](src/game/opening.test.ts), [cards](src/game/cards.test.ts), [room](server/room.test.ts), [host transfer](server/host-transfer.test.ts).

## Players, dealing and order

- A match has 2–8 named players. Local practice adds one human to 1–7 bots.
- Each round uses one 52-card deck plus one Printed Joker for 2–4 surviving players, or two decks plus two Printed Jokers for 5–8. Physical cards have unique IDs even across decks.
- Randomly choose an indicator excluding 7 and Printed Joker; remove that physical card from play. Its rank is the **Round Joker**. Deal seven cards to every non-eliminated player; reveal one opening card in the Drop Pile.
- The first starter is randomly selected. Later starters advance clockwise from the previous starter among eligible players, not automatically to the previous winner.
- Normal rotation skips eliminated and round-forfeited players. After `round-over`, `next-round` clears round forfeits and redeals surviving players. Online advancement is a host-authorized action, not an automatic countdown.

## Values and matching

| Card | Hand value |
| --- | --- |
| Ace | 1 |
| 2–6, 8–10 | Printed number unless its rank is Round Joker |
| Jack, Queen, King | 10 unless its rank is Round Joker |
| 7 | Always 7; cannot be the indicator |
| Printed Joker | 0 |
| Remaining cards of the Round Joker rank | 0 |

A drop contains one or more distinct owned cards **of exactly the same rank**. Zero value does not make different ranks match. Printed Jokers match only Printed Jokers; neither kind of joker is a universal wildcard. Suit does not affect drop matching.

## Normal turns, opening card and replacement

1. Before dropping on a normal turn, an eligible player may Declare Least.
2. Otherwise drop a legal same-rank selection. Merely selecting cards does not change authoritative state.
3. A non-7 matching the previous visible top rank is **Match and Drop**: finish with no replacement.
4. A nonmatching non-7 drop needs exactly one replacement. With a legal preceding eligible group, enter `draw` and choose one named open card or one hidden Draw Pile card. Without an open choice, draw one hidden replacement automatically in the same accepted action.
5. Advance only after the required replacement or an action that needs none. The committed drop and pending pickup eligibility survive refresh/reconnect.

The first normal player also drops first. A non-7 opening card is initialized as the previous eligible drop, including a Printed Joker or Round Joker rank card. Matching it does not force the player to use Match and Drop.

Open pickups come only from the immediately preceding eligible group, never older groups or the player's own newly dropped cards. Consecutive Match and Drop turns replace eligibility with the most recent group. Penalty acceptance and timeouts clear eligibility. **Rank 7 is never an open pickup**, including stale saved eligible IDs and manually submitted actions; drawing a 7 from the hidden pile is legal. The UI currently offers the first legal eligible card without an All Open Cards chooser; the engine remains responsible for legality.

## Power Card 7

- One or several 7s dropped in one action finish immediately, require no replacement, and add **two** penalty cards per action, not per 7.
- The next active player may respond with 7s or accept the accumulated closed-card penalty and lose the normal turn. With no held 7, acceptance resolves automatically.
- While a penalty is pending, normal drops and Declare Least are unavailable.
- When every active player consecutively participates, cancel the penalty and return a normal turn to the initiator. The 7s stay in the Drop Pile; they do not become eligible open pickups.
- An opening 7 immediately starts a two-card penalty. The starter is the initiator but is counted as participating only after actually playing a 7. The revealed computer card is not a participant.
- The existing deck supply cannot support a complete opening cycle at 4 or 8 players after the opening 7 is removed from circulation. Do not create extra 7s or count the opening card as a player to work around this.

## Declare Least and scores

Available only at the beginning of the current player's normal `turn`, before dropping, with hand value **≤5**. It is unavailable in penalty/draw phases. Emptying a hand does not end the round: the player must Declare Least at their next normal turn; an empty hand cannot make another drop or pass.

A declaration succeeds if the caller is strictly lower than every non-forfeited opponent, **or the caller has zero**. A positive-point tie therefore fails; a zero-point tie succeeds and all zero-point players are round winners.

| Round outcome | Declarer | Other active players |
| --- | --- | --- |
| Successful Least | 0 penalty | `min(handTotal, 40)` each |
| Failed Least | +40 penalty | 0 penalty each |

A zero penalty alone does not imply a round victory after a failed declaration: the lowest-hand noncalling opponents are the winners. Round reports preserve uncapped hand totals separately from round penalties and cumulative scores. Already-forfeited players retain their +40 penalty even if a later declaration fails; it is not charged twice or waived.

## Timer, forfeit and elimination

- **Current implementation: 45 seconds**, not 60, for timed turns (`TURN_MS`, `roomSettings`). Hosts choose timed or untimed; arbitrary timer durations are not implemented. Untimed deadlines are `null`.
- One deadline spans dropping and replacement choice. Animation, refresh, reconnect and selection do not extend it. The server uses its time and alarms; a late action resolves the expired player's timeout before it can evade the deadline.
- Timeout immediately forfeits the current round, adds **40 once**, removes that hand from round play, clears the pending 7 sequence/open eligibility, and moves to the next eligible player.
- A forfeited player spectates and is excluded from actions and Least comparisons. Settlement reports the existing +40 without adding hand values or recharging it.
- If only one round-eligible player remains after forfeits, settle the round with zero additional penalty for that player.
- Permanent elimination occurs when cumulative score reaches/exceeds the configured positive-integer cutoff (default **100**). A forfeiter below it returns next round; reaching it eliminates immediately.
- Continue ordinary rounds until at most one non-eliminated survivor remains. There is no special tiebreaker round, score reset or suspension of the cutoff. Do not invent an extra tie-resolution mode for a degenerate result without explicit instruction.

## Recycling and exhaustion

When a required closed draw finds the Draw Pile empty, shuffle older Drop Pile cards while protecting the current top group and pending eligible IDs. The indicator remains out of play. If no card can be drawn, resolve by hand totals: active minimum-total players receive zero, other active players receive their **uncapped** totals. The 40 cap is specific to successful Least; do not silently extend it to exhaustion. Existing forfeits remain +40 once.

## Multiplayer and compatibility boundaries

A room starts only when all configured seats are filled, connected and authorized, on the host's explicit start. `server/room.ts` validates actions and constructs per-player projections; hidden hands and deck order never go to other clients. Host handover is room administration, not a turn or scoring change. An eliminated host can choose an eligible connected active replacement within 30 seconds; automatic fallback handles missing/expired selection and sole eligible survivors. A forfeit below the cutoff alone does not remove host privileges.

The engine's internal action names (`discard`, `show`, `source: 'discard'`) and saved-state version are compatibility contracts, not player-facing language. `normalizeLegacyTurn`/`resolveForcedDraw` handle older acquisition phases and unnecessary pending draws without restarting deadlines. Keep illegal actions immutable and preserve card IDs through accepted transfers/recycling.

## Intended or pending work, not implemented rules

[TODOS](TODOS.md) contains ideas such as automatic next-round countdowns, rematches and guided tutorials. It is not a feature-status source. The Lounge Tutorial is currently a placeholder modal. Guest online play is gated off by default and can be enabled by Worker configuration; local practice remains available to valid guests. Physical iPhone PWA first-rotation alignment remains [open issue #63](https://github.com/chavaphanish/least-count/issues/63), not a gameplay rule or a verified fix.
