# Least Count — current working rules

These amendments are authoritative for the current implementation. Read them with the original [Edition 2.0 working draft](../RULEBOOK.md) and [confirmed decisions](rule-clarifications.md). These amendments and confirmed decisions take precedence over conflicting wording in the archived original, which is preserved unchanged. Unaffected scoring, Show, ownership, elimination, and deck rules remain in effect.

## Normal turns and replacement draws

Discard one card or a group of the same rank. A normal discard requires exactly one replacement, except for Match and Drop and Power Card 7 actions.

**When a player must draw a replacement card and no eligible card from the immediately preceding player's discard is available, the game automatically draws exactly one card from the face-down draw pile.**

- Discard and automatic draw are one authoritative action. No additional click is required.
- If an eligible preceding discard exists, the player chooses one card from that group or the draw pile. The UI keeps the previous group visible while planning; it commits the discard and selected pickup together.
- Only the immediately preceding eligible group is available. Older groups and the player's own new discard cannot be picked up.
- Match and Drop requires no replacement draw when the played rank matches the prior top rank, except that 7 always follows its Power Card transition.
- Automatic replacement drawing never applies to 7 actions, Show, ended rounds, or eliminated players. Penalty draws are separate.
- Accepting a penalty or timing out clears previous pickup eligibility. The next required normal replacement is therefore automatic.
- The existing replenishment and exhaustion rules apply if the closed pile is empty. Older unprotected discards are reshuffled; if the required draw still cannot finish, settle by hand totals.
- Selection and a manual draw choice share the same deadline. Automatic drawing adds no time to that turn. Only completing a turn starts the next player's deadline.

Example: Alex discards K♥ onto a 3. With no eligible preceding group, one closed card is drawn automatically and Ben acts next. If the preceding group's 3 is eligible, Alex instead chooses that 3 or a closed card. The closed card's identity stays private.

## Power Card 7 — immediate completion

**When a player legally discards one or more 7s, the player's turn ends immediately without drawing a replacement card. The Power Card penalty is then applied to the next active player.**

- This applies both when initiating and responding to a 7 sequence.
- It overrides normal replacement drawing and the matching-discard exception. A 7 never enters a normal replacement-draw phase, even when the prior top rank differs.
- One or several 7s played together count as one action and add exactly two penalty cards.
- The next player may play one or more 7s or accept the accumulated penalty and lose the normal turn. With no 7 held, the penalty is applied automatically under the existing rule.
- The full-cycle rule is unchanged for 2–8 active players: once every active player has consecutively participated, cancel the penalty without drawing and give the initiator the next normal turn.
- A starting face-up 7 still has no power effect. The next legally played 7 initiates a sequence.
- Timed actions retain the existing 60-second deadline. Untimed rooms have no deadline. Show cannot be called during a penalty.

Example: Alex plays two 7s, draws nothing, and Ben faces two penalty cards. Ben plays a 7, draws nothing, and Chris faces four. If all active players participate consecutively, no penalty is drawn and Alex takes the next normal turn.

## Game Activity Log

Online games and local practice show a compact **Game Activity** panel. Desktop shows the latest five events; mobile (600px wide or less) shows three. The newest event is highlighted. **View Full History** opens a scrollable chronological list with round numbers; **Show Recent Activity** returns to the compact view without changing gameplay.

The server generates ordered structured public events after validated transitions. Connected players receive the same history, and reconnection restores retained events. A normal completed turn has one meaningful discard/draw summary; exceptional events cover 7s, penalties, full cycles, Show, scoring, elimination, recycling, and match completion. Retain up to the most recent 2,000 events across rounds of the current match. Sequence numbers continue even after older events are removed. New updates never force the expanded history to scroll.

Discarded cards and publicly picked-up cards may be named. Closed-pile replacements and penalty cards are described by source/count only. Neither descriptions nor raw public event payloads include hidden cards, opponents' hands, closed deck order, email addresses, or authentication data. Round results expose totals and penalties, not individual hands.

## Printed Joker presentation

PJ remains the rulebook/internal abbreviation for **Printed Joker**. The visible card shows an original jester illustration and the word **JOKER**, without visible PJ letters. It remains worth zero, matches only other Printed Jokers, and is not a universal wildcard. Selected Joker rules are unchanged.

## Room defaults and quick start

Online rooms default to four players, a cumulative cutoff of 100, and timed 60-second turns. Hosts may choose 2–8 players, another positive integer cutoff, or untimed play. Deal seven cards each using one standard deck plus one Printed Joker for 2–4 active players, or two decks plus two Printed Jokers for 5–8.

On your normal turn, call Show if eligible or select same-rank cards. Play 7s immediately; use Match and Drop when the prior top rank matches; otherwise draw automatically when there is no open choice, or choose a source when there is. Follow the live activity panel. Round scoring, zero-point ties, cumulative elimination, and ordinary next rounds follow the confirmed decisions; no special tiebreaker round is introduced.
