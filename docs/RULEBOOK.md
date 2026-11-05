# Least Count — current working rules

These amendments are authoritative for the current implementation. Read them with the original [Edition 2.0 working draft](../RULEBOOK.md) and [confirmed decisions](rule-clarifications.md). These amendments and confirmed decisions take precedence over conflicting wording in the archived original, which is preserved unchanged. Unaffected scoring, Show, ownership, elimination, and deck rules remain in effect.

## Round initialization and the opening turn

At every new round, prepare the existing one- or two-deck composition, choose an eligible Selected Joker (excluding 7s and Printed Jokers), remove that physical indicator, deal exactly seven cards to each active player, and reveal one remaining card face up. The starting player is random for the first round and rotates clockwise among active players on later rounds. The opening card is public to everyone.

### Non-7 opening card: draw first, then discard

The starting player explicitly chooses **Pick Up the Opening Card** or **Draw New Card**. No closed draw is selected automatically while the face-up card is a legal choice. This also applies if the opening card is a Printed Joker or has the Selected Joker's rank.

Taking the face-up card moves that same physical card into the starting player's private hand and removes it from the discard pile. The pile may temporarily be empty. Choosing the closed pile instead draws exactly one private card and leaves the opening card visible. Either choice takes the hand from seven to eight cards and may be made only once.

The player then discards one card or a legal same-rank group and ends the opening turn. **No second replacement draw occurs**, whether or not the discard matches the prior visible rank. Playing one or more 7s here starts the normal two-card penalty without an additional replacement. The next eligible normal turn uses the existing discard-first rules; the draw-first opening is not repeated after a skipped or timed-out opening turn.

Show remains available before acquiring an opening card if the original seven-card hand is worth five or less. After either opening acquisition, Show is unavailable for the rest of that turn. A timed opening has one shared 60-second deadline across choosing and discarding; refreshes and the partial acquisition do not reset it. Untimed rooms remain untimed. Timeout elimination continues to clear pickup eligibility and any penalty.

### Opening 7: immediate two-card penalty

**A computer-revealed opening 7 activates its Power Card effect immediately.** It cannot be picked up as an ordinary opening card. The starting player must accept two closed penalty cards and skip discarding, or respond with one or more 7s. Without a 7, the two-card penalty is drawn automatically and the next active player takes a normal turn.

Responding with one or several 7s adds exactly two to the opening penalty (two becomes four), requires no replacement draw, and passes the response to the next active player. Show and non-7 discards are unavailable while a penalty is active.

For full-cycle tracking, the starting player is the initiator but is recorded as a participant only when they actually play 7s. The computer's revealed card is **not** a player response. If every active player consecutively responds with a 7, cancel the penalty and return the next **normal** turn to the starting player. Accepting a penalty or timing out ends that opening sequence under the existing rules.

**Physical-card limitation:** Existing decks are unchanged. After an opening 7, a four-player single-deck round has only three other 7s, and an eight-player two-deck round has only seven. An all-player opening cycle therefore cannot naturally occur at those sizes; the engine never creates an extra 7 or counts the computer as a player. Full-cycle tracking applies to all sizes whenever the actual card supply permits it.

### Opening examples and quick start

- **Opening 3♠:** Alex chooses the visible 3 or one closed card, then discards two Queens. Alex draws no second card; Ben takes a normal turn.
- **Opening 7♥:** Alex holds a 7 and may draw two and skip, or play 7♠ with no replacement; Ben then faces four penalty cards. If Alex holds no 7, the two-card draw and skipped turn resolve automatically.
- **Three-player opening cycle:** With one revealed 7 and one remaining 7 per player, Alex, Ben, and Chris each respond. The penalty is cancelled, and Alex takes the next normal turn without another opening acquisition.

The activity log records the revealed card, the public opening pickup or unnamed closed draw, completion of the opening discard, and opening penalties/full cycles. Closed acquisition and penalty card identities are never included in public events. The phase, single acquisition, and shared deadline persist on the server and survive reconnection; retries cannot acquire the card twice.

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
- A starting face-up 7 immediately activates the opening penalty described above; its first responding player is not credited until they actually play a 7.
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

First resolve the opening choice or opening 7 penalty as described above. On subsequent normal turns, call Show if eligible or select same-rank cards. Play 7s immediately; use Match and Drop when the prior top rank matches; otherwise draw automatically when there is no open choice, or choose a source when there is. Follow the live activity panel. Round scoring, zero-point ties, cumulative elimination, and ordinary next rounds follow the confirmed decisions; no special tiebreaker round is introduced.
