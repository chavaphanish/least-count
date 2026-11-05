# Rule clarifications — confirmed decisions

The supplied [Least Count rulebook](../RULEBOOK.md), Edition 2.0 (Working Draft), remains a **provisional reference**. Its original wording, including the “Official Game Rulebook” heading, is preserved unchanged. The decisions below were confirmed by the user on 5 November 2026 and take precedence over conflicting passages in that uploaded draft. Other rules may be refined in later stages.

This document records rule decisions. See the [README](../README.md) for the current implementation status and local-practice limitations.

## 1. Open pickup after Match and Drop

**Reference:** Sections 2.2.3, 5.3, 5.4, and 13.1.

**Confirmed:** After consecutive Match and Drop turns, only the immediately preceding player's latest discard group is available for open pickup. Older groups are unavailable. On a turn requiring a replacement draw, the player may choose one card from that eligible group or one card from the draw pile. A Match and Drop turn itself still requires no draw.

**Example:** A discards two 5s using Match and Drop. B then discards a 5 using Match and Drop. C discards a King and must draw. C may take B's 5 or a card from the draw pile, but neither of A's 5s.

**Confirmed — penalty draw:** Accepting a 7 penalty clears the previous discard group's pickup eligibility. The next player's required replacement draw must come from the draw pile. This covers the normal turn lost as part of accepting the penalty; it does not introduce any other kind of skipped turn.

**Example:** A plays a 7. B draws the two-card penalty and loses their normal turn without discarding. C discards a King and must draw from the draw pile. C cannot take A's 7.

**Confirmed — timeout:** A player's timeout also clears the previous discard group's pickup eligibility. The next player's required replacement draw must come from the draw pile.

**Example:** A discards a 9 and completes their turn. B times out without discarding and is eliminated. C discards a King and must draw from the draw pile. C cannot take A's 9.

These transitions do not make older discard groups available again. They do not add a draw to a Match and Drop turn, which still requires no replacement draw.

## 2. Empty hand and zero-point Show ties

**Reference:** Sections 5.1, 7.1, 7.3–7.5, and 8.1–8.3.

**Confirmed:** A player who empties their hand must wait until the beginning of their next normal turn and then call Show. There is no option to pass. Emptying the hand does not automatically end the round. The restriction on Show during an active 7 penalty remains in effect.

When a zero-point Show is tied by other zero-point hands, the caller and all other zero-point players are tied **round winners**, each receiving zero round penalty points. The caller does not receive the failed-Show penalty of 40 points for this zero-point tie. Other active players receive their hand totals as round penalty points under the existing scoring rules.

**Example:** A empties their hand through Match and Drop. On A's next normal turn, A must call Show. If B also has a hand total of zero, both A and B receive zero round penalty points. If C has a hand total of 8, C receives 8 round penalty points. The tied round result does not itself end the match.

**Draft conflict:** The zero-point tie decision overrides the draft's requirement that the caller be strictly lower than every opponent and its blanket 40-point penalty for a tied Show. Do not extend this exception to positive-point Show ties without confirmation.

## 3. Continue ordinary rounds; no tiebreaker rounds

**Reference:** Sections 8 and 10.1–10.4.

**Confirmed:** There is no special tiebreaker round. Cumulative scores continue across ordinary rounds, and the elimination threshold remains in effect. A score of 100 or more eliminates a player under the default cutoff; a score below 100 does not. Continue ordinary rounds until elimination leaves the match winner. The existing timeout-elimination rule is unchanged.

**Example:** Only A and B remain, each with 99 cumulative points. A calls Show with zero, and B also has zero. Both receive zero round penalty points and remain at 99. Neither is eliminated and neither wins the match at this point. Start another ordinary round, retaining the scores and the 100-point cutoff. Continue until one player is eliminated.

**Draft conflict:** Do not implement the special tiebreaker procedure in Section 10.4, including its suspension of the cumulative elimination threshold. A tie does not reset scores, suspend elimination, or create a separate tiebreaker mode.

## Next review

The three initial clarification topics have been answered. These notes record the user's current decisions without rewriting the uploaded source document or declaring the whole rulebook final. Any further unresolved case should remain explicit rather than being settled silently in code.
