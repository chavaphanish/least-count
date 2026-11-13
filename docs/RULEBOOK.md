# YAYDU — current working rules

These amendments are authoritative for the current implementation. Read them with the original [Edition 2.0 working draft](../RULEBOOK.md) and [confirmed decisions](rule-clarifications.md). These amendments and confirmed decisions take precedence over conflicting wording in the archived original. Its gameplay rules are retained; display terminology is updated to Drop, Declare Least, and Round Joker. Unaffected scoring, Least, ownership, elimination, and deck rules remain in effect.

## Round initialization and the opening turn

At every new round, prepare the existing one- or two-deck composition, choose an eligible Round Joker (excluding 7s and Printed Jokers), remove that physical indicator, deal exactly seven cards to each active player, and reveal one remaining card face up. The starting player is random for the first round and rotates clockwise among active players on later rounds. The opening card is public to everyone.

### Non-7 opening card: standard drop first

**The first player follows the standard drop-first turn sequence. The initial face-up drop card is treated as an eligible previous drop for matching and pickup purposes. The player may pick up this card only after making a legal drop that requires a replacement draw. If the player performs Match and Drop or plays a 7, no replacement card is drawn.**

The starting player sees seven cards and may declare Least if eligible, or drop one card or a legal same-rank group. Drawing and pickup controls are inactive before a legal drop. Having a card matching the opening rank does not force Match and Drop; the player may legally drop another rank.

After a normal nonmatching drop, the opening card remains the eligible pickup while the player's new drop becomes the visible latest group. The player chooses exactly one card from that eligible group or the closed pile. Taking the opening card moves that same physical ID into the hand and removes it from the pile; the new drop remains in place. The player cannot take their own new drop. This also applies to Printed Joker and Round Joker rank openings.

The drop is committed and animated before the replacement choice is made. A refresh during that choice restores the committed drop, eligible reference, and remaining deadline. The replacement ends the turn. Drop flights finish before incoming pickup flights; an automatic closed replacement is presented in the same order without another click.

Match and Drop and legally playing 7s end the first player's action without a replacement. Least is available at the beginning of the normal turn, before dropping, and is unavailable afterward. One timed deadline covers dropping and any required replacement; dropping, animations, refreshes, and reconnecting do not reset it. Untimed rooms stay untimed.

### Opening 7: immediate two-card penalty

**A computer-revealed opening 7 activates its Power Card effect immediately.** It cannot be picked up as an ordinary opening card. The starting player must accept two closed penalty cards and skip dropping, or respond with one or more 7s. Without a 7, the two-card penalty is drawn automatically and the next active player takes a normal turn.

Responding with one or several 7s adds exactly two to the opening penalty (two becomes four), requires no replacement draw, and passes the response to the next active player. Least and non-7 drops are unavailable while a penalty is active.

For full-cycle tracking, the starting player is the initiator but is recorded as a participant only when they actually play 7s. The computer's revealed card is **not** a player response. If every active player consecutively responds with a 7, cancel the penalty and return the next **normal** turn to the starting player. Accepting a penalty or timing out ends that opening sequence under the existing rules.

**Physical-card limitation:** Existing decks are unchanged. After an opening 7, a four-player single-deck round has only three other 7s, and an eight-player two-deck round has only seven. An all-player opening cycle therefore cannot naturally occur at those sizes; the engine never creates an extra 7 or counts the computer as a player. Full-cycle tracking applies to all sizes whenever the actual card supply permits it.

### Opening examples and quick start

- **Opening 9♥:** Alex drops K♠ first, then chooses the eligible 9♥ or one closed replacement. The 9♥ remains eligible while K♠ is the latest drop. Ben acts after the replacement.
- **Opening 9♥, matching group:** Alex drops 9♠ and 9♦, draws nothing, and Ben acts immediately. Alex may instead drop another rank and make a normal replacement choice.
- **Opening 7♥:** Alex holds a 7 and may draw two and skip, or play 7♠ with no replacement; Ben then faces four penalty cards. If Alex holds no 7, the two-card draw and skipped turn resolve automatically.
- **Three-player opening cycle:** With one revealed 7 and one remaining 7 per player, Alex, Ben, and Chris each respond. The penalty is cancelled, and Alex takes the next normal turn without another opening acquisition.

The activity log records the revealed card, completed drop/replacement summaries with public pickups or unnamed closed draws, and opening penalties/full cycles. Closed acquisition and penalty card identities are never included in public events. The normal turn/draw phase, committed drop, eligible reference, and shared deadline persist on the server; retries cannot acquire a card twice.

## Normal turns and replacement draws

Drop one card or a group of the same rank. A normal drop requires exactly one replacement, except for Match and Drop and Power Card 7 actions.

**When a player must draw a replacement card and no eligible card from the immediately preceding player's drop is available, the game automatically draws exactly one card from the face-down draw pile.**

- Drop and automatic draw are one authoritative action. No additional click is required.
- If an eligible preceding drop exists, the player chooses one card from that group or the draw pile. The drop is committed first. The previous eligible group remains available until the player chooses the replacement; it is not overwritten by the new top drop.
- Only the immediately preceding eligible group is available. Older groups and the player's own new drop cannot be picked up.
- Match and Drop requires no replacement draw when the played rank matches the prior top rank, except that 7 always follows its Power Card transition.
- Automatic replacement drawing never applies to 7 actions, Least, ended rounds, or eliminated players. Penalty draws are separate.
- Accepting a penalty or timing out clears previous pickup eligibility. The next required normal replacement is therefore automatic.
- The existing replenishment and exhaustion rules apply if the closed pile is empty. Older unprotected drops are reshuffled; if the required draw still cannot finish, settle by hand totals.
- Selection and a manual draw choice share the same deadline. Automatic drawing adds no time to that turn. Only completing a turn starts the next player's deadline.

Example: Alex drops K♥ onto a 3. With no eligible preceding group, one closed card is drawn automatically and Ben acts next. If the preceding group's 3 is eligible, Alex instead chooses that 3 or a closed card. The closed card's identity stays private.

## Power Card 7 — immediate completion

**When a player legally drops one or more 7s, the player's turn ends immediately without drawing a replacement card. The Power Card penalty is then applied to the next active player.**

- This applies both when initiating and responding to a 7 sequence.
- It overrides normal replacement drawing and the matching-drop exception. A 7 never enters a normal replacement-draw phase, even when the prior top rank differs.
- One or several 7s played together count as one action and add exactly two penalty cards.
- The next player may play one or more 7s or accept the accumulated penalty and lose the normal turn. With no 7 held, the penalty is applied automatically under the existing rule.
- The full-cycle rule is unchanged for 2–8 active players: once every active player has consecutively participated, cancel the penalty without drawing and give the initiator the next normal turn.
- A starting face-up 7 immediately activates the opening penalty described above; its first responding player is not credited until they actually play a 7.
- Timed actions retain the existing 60-second deadline. Untimed rooms have no deadline. Least cannot be called during a penalty.

Example: Alex plays two 7s, draws nothing, and Ben faces two penalty cards. Ben plays a 7, draws nothing, and Chris faces four. If all active players participate consecutively, no penalty is drawn and Alex takes the next normal turn.

## Game Activity Log

Online games and local practice show a compact **Game Activity** panel. Desktop shows the latest five events; mobile (600px wide or less) shows three. The newest event appears first and is highlighted in the compact view. **View Full History** opens a scrollable chronological list with round numbers; **Recent Activity** returns to the compact view without changing gameplay.

The server generates ordered structured public events after validated transitions. Connected players receive the same history, and reconnection restores retained events. A normal completed turn has one meaningful drop/draw summary; exceptional events cover 7s, penalties, full cycles, Least, scoring, elimination, recycling, and match completion. Retain up to the most recent 2,000 events across rounds of the current match. Sequence numbers continue even after older events are removed. New updates never force the expanded history to scroll.

Dropped cards and publicly picked-up cards may be named. Closed-pile replacements and penalty cards are described by source/count only. Neither descriptions nor raw public event payloads include hidden cards, opponents' hands, closed deck order, email addresses, or authentication data. Round results expose totals and penalties, not individual hands.

## Printed Joker presentation

PJ remains the rulebook/internal abbreviation for **Printed Joker**. The visible card shows an original jester illustration and the word **JOKER**, without visible PJ letters. It remains worth zero, matches only other Printed Jokers, and is not a universal wildcard. Round Joker rules are unchanged.

## Room defaults and quick start

Online rooms default to four players, a cumulative cutoff of 100, and timed 60-second turns. Hosts may choose 2–8 players, another positive integer cutoff, or untimed play. Deal seven cards each using one standard deck plus one Printed Joker for 2–4 active players, or two decks plus two Printed Jokers for 5–8.

On the first and all subsequent normal turns, declare Least if eligible or drop same-rank cards before any required replacement. Resolve an opening 7 as a penalty instead. Play 7s immediately; use Match and Drop when the prior top rank matches; otherwise draw automatically when there is no open choice, or choose a source when there is. Follow the live activity panel. Round scoring, zero-point ties, cumulative elimination, and ordinary next rounds follow the confirmed decisions; no special tiebreaker round is introduced.

## Guided turn controls (presentation only)

The action bar uses the current validated turn phase. On a normal turn, select cards to **Drop**, then **Draw New Card** from the hidden Draw Pile or **Pick Up** a named open card from the Drop Pile only when a replacement is needed. The primary label names the selected group, such as **Drop 2 Queens** or **Play 2 Sevens**. Selecting a different rank replaces the current selection; **Select All Matching** selects the remaining cards of that rank. Only matching groups may be submitted. Selection alone does not commit the turn.

**Declare Least** replaces the former declaration name. It is offered only when the existing eligibility check permits it at the beginning of a normal turn (five points or less), before a Drop. A player may continue with a normal Drop instead when a legal Drop exists. An empty hand still requires declaring Least; there is no pass. Unique-lowest success, positive-point tie failure with a 40-point penalty, zero-point shared winners, and elimination are unchanged.

During a 7 penalty response, only playing 7s or drawing the current penalty is offered. Without a 7, the existing engine draws the penalty automatically. Match and Drop, playing 7s, and required closed replacements without an eligible open choice still complete automatically under the existing rules. Waiting players see the active player's name instead of gameplay buttons.

The countdown appears beside the active player's profile, with a warning at 15 seconds and a stronger warning at 5. Untimed games hide the countdown. The deadline remains authoritative and spans the Drop and replacement choice; selection, animations, refreshes, and reconnection never extend it. Dealing and mandatory transitions execute synchronously before control is returned, without waiting on client animation acknowledgements.


## Declare Least round penalties

A failed Least declaration gives only the declarer **40 penalty points**. Every other active player receives **0**, regardless of hand value. A successful Least declaration gives the declarer **0**; each other active player receives **min(hand value, 40)**. Add these penalties to cumulative scores and apply the existing elimination cutoff. Hand values themselves remain unchanged in round reports and statistics.

Declaration eligibility, success conditions, zero-point ties, round winners, exhaustion scoring, and all other mechanics remain unchanged. Zero penalty points alone do not make an opponent a round winner after a failed declaration.
