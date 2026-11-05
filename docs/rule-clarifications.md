# Rule clarifications — pending decisions

The supplied [Least Count rulebook](../RULEBOOK.md), Edition 2.0 (Working Draft), is a **provisional reference**. Its original wording, including the “Official Game Rulebook” heading, has been preserved unchanged. The user has not finalized these rules; this document records questions, not additional rules or implementation instructions.

No gameplay rules are implemented by this documentation change. The current application remains a visual prototype, and its sample hand, player seats, and deck utilities do not establish game rules.

## 1. Open pickup after Match and Drop

**Reference:** Sections 2.2.3, 5.3, 5.4, and 13.1.

The draft allows one card from the immediately preceding player's latest eligible discard group, prohibits older discards, and makes skipping the draw mandatory on a matching discard. It does not explicitly define every transition of pickup eligibility.

**Question:** After consecutive Match and Drop turns, does each new discard group replace the preceding eligible group, so that only the immediately preceding player's latest group can be picked up on the next turn that requires a draw? Also confirm whether an intervening 7-penalty draw, skipped turn, or timeout clears eligibility.

**Decision:** Pending. Do not infer that older groups become available again.

## 2. Empty hand at the next normal turn

**Reference:** Sections 5.1, 7.1, and 7.5.

The draft explicitly says an empty hand is worth zero, does not end the round automatically, and must wait until the next normal turn to declare Show. It does not define a normal action for an empty-handed player who chooses not to declare Show.

**Question:** Must that player declare Show at the beginning of their next normal turn, or may they pass? If passing is allowed, what ends the turn and what happens to the timer? This question does not change the separate restrictions on Show during a 7 penalty.

**Decision:** Pending. Do not introduce passing, automatic victory, or a forced Show without confirmation.

## 3. Tiebreaker winner and score basis

**Reference:** Sections 8 and 10.4.

The draft says tied players enter an extra round without the cumulative score-elimination threshold and repeat if the resulting round scores tie. It does not fully specify how a winner is selected when some, but not all, tiebreaker participants tie.

**Question:** Does the unique lowest penalty score in the extra round determine the winner independently of previous cumulative totals? If several players tie for the lowest score, do only those players enter the next tiebreaker? Confirm how this applies when an unsuccessful Show awards zero to multiple opponents.

**Decision:** Pending. Do not substitute remaining hand totals or previous cumulative totals for round penalties without confirmation.

## Recording decisions

Record the user's answers here before implementing the affected behavior. Keep the uploaded working draft intact until a revision is explicitly requested. Other rules may be refined in later stages; this list is an initial review, not a declaration that all remaining edge cases are settled.
