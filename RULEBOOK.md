# LEAST COUNT
## Official Game Rulebook

**Edition:** 2.0 (Working Draft)  
**Game Type:** Multiplayer card game  
**Players:** 2 to 8  
**Starting Hand:** 7 cards  
**Platform:** Browser-based game with planned mobile support  
**Turn Duration:** 60 seconds  
**Default Elimination Threshold:** 100 points

---

# 1. Introduction

## 1.1 Overview

Least Count is a multiplayer card game in which players compete to maintain the lowest possible total value of cards in their hands.

Players take turns dropping cards and drawing new cards, strategically reducing their hand totals while monitoring the cards played by their opponents.

A player who has a sufficiently low hand total may declare **Least**, ending the round and triggering a comparison of the remaining hand totals.

The game introduces two types of Jokers and a special Power Card, the number 7, which can force opponents to draw additional cards.

Multiple rounds are played, with penalties accumulating across rounds. Players are eliminated when they reach the elimination threshold or fail to complete an action within the permitted time.

The last remaining player wins the game.

## 1.2 Objective

The primary objectives are to:

1. Reduce the total point value of cards in your hand.
2. Use matching-card drops to reduce the number of cards held.
3. Use Printed Jokers (PJ) and Round Jokers (RJ) to maintain low hand values.
4. Strategically use the 7 Power Card against opponents.
5. Declare Least when eligible and when your hand is likely to have the lowest total.
6. Avoid accumulating 100 or more penalty points.
7. Complete every turn within 60 seconds.

The game rewards strategic card management, risk assessment, and decision-making.

---

# 2. Game Components and Configuration

## 2.1 Number of Players

Least Count supports a minimum of 2 and a maximum of 8 players.

The game uses one or two standard playing-card decks depending on the number of players participating.

| Number of Players | Standard Decks | Printed Jokers (PJ) | Starting Cards per Player |
|---|---|---|---|
| 2 to 4 | 1 | 1 | 7 |
| 5 to 8 | 2 | 2 | 7 |

Each standard deck contains 52 cards consisting of four suits:

- Spades (♠)
- Hearts (♥)
- Diamonds (♦)
- Clubs (♣)

Each suit contains 13 ranks, from Ace through King.

Only one Printed Joker is included per deck.

Therefore:

- A single-deck game initially contains 53 cards.
- A two-deck game initially contains 106 cards.

There are no alternative starting-hand sizes. Every player always receives seven cards at the beginning of a round.

## 2.2 Game Areas

The game interface consists of the following areas.

### 2.2.1 Player Hand

Displays the cards belonging to the current player.

Players can view and interact only with their own cards.

The contents of other players' hands are always hidden.

### 2.2.2 Draw Pile

Contains the remaining face-down cards.

Players draw from this pile during normal turns or when required by a Power Card penalty.

### 2.2.3 Drop Pile

Contains cards dropped during gameplay.

The most recent legal drop is displayed face up.

The game must preserve the most recent drop group when it is eligible for pickup by the next player.

### 2.2.4 Round Joker Indicator

Displays the Round Joker (RJ) card for the current round.

The selected card is physically removed from the playable deck and remains visible throughout the round.

Its rank determines which cards receive a value of zero.

### 2.2.5 Player Information

For each player, the interface displays:

- Player name or identifier
- Number of cards remaining
- Cumulative penalty score
- Active or eliminated status
- Current turn indication
- Remaining turn time, when applicable

The actual cards held by other players must never be displayed.

---

# 3. Card Values and Jokers

## 3.1 Standard Card Values

The point values of cards are defined as follows.

| Card | Point Value |
|---|---|
| Printed Joker (PJ) | 0 |
| Round Joker (RJ) | 0 |
| Ace | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |
| 6 | 6 |
| 7 | 7 |
| 8 | 8 |
| 9 | 9 |
| 10 | 10 |
| Jack | 10 |
| Queen | 10 |
| King | 10 |

When a rank is selected as the RJ, its normal value is overridden and becomes zero.

The rank 7 is always worth seven points and cannot be selected as an RJ.

## 3.2 Printed Joker (PJ)

A Printed Joker is the physical Joker card included in a standard deck.

The following rules apply:

1. Exactly one PJ is included per deck.
2. PJ always has a point value of zero.
3. PJ cannot be selected as the RJ indicator.
4. PJ does not automatically substitute for any other card rank.
5. PJ is treated as its own rank for matching-card drops.

For a game using two decks, the two PJs may be dropped together as a matching group.

## 3.3 Round Joker (RJ)

At the beginning of each round, one eligible card is randomly selected to determine the RJ rank.

All cards matching that rank become zero-point cards for the entire round, regardless of suit.

**Example:**

Suppose 4♥ is selected as the RJ.

The following cards are worth zero:

- 4♠
- 4♥
- 4♦
- 4♣

The physically selected 4♥ is removed from the playable deck.

Therefore, in a single-deck game, only the other three 4s remain available for gameplay.

In a two-deck game, seven playable cards of rank 4 remain after removing the selected indicator.

### 3.3.1 RJ Selection Restrictions

The following rules apply:

1. The RJ is selected randomly at the beginning of every round.
2. A card with rank 7 cannot be selected.
3. A Printed Joker cannot be selected.
4. If an ineligible card is drawn, it is returned to the deck and the selection is repeated.
5. The selected physical card is removed from the playable deck for the entire round.
6. The selected card is displayed in the RJ indicator area.
7. Every remaining card with the selected rank receives a value of zero.
8. The RJ remains unchanged until the round ends.
9. A new RJ is selected for the next round.

### 3.3.2 RJ Matching Rules

Although RJ cards have a value of zero, they retain their original rank.

For example, if 9 is the RJ, two cards of rank 9 can be dropped together.

However, a 9 and a Printed Joker cannot be dropped together because they do not have the same rank.

---

# 4. Starting a Round

## 4.1 Automatic Deck Preparation

The game is completely computer-managed.

There is no human dealer.

At the beginning of each round, the computer:

1. Identifies the active players.
2. Determines the number of decks required.
3. Includes exactly one PJ per deck.
4. Shuffles all cards.
5. Selects an eligible RJ indicator.
6. Removes the selected card from the playable deck.
7. Reshuffles the remaining playable cards.
8. Deals seven cards to each active player.
9. Places the remaining cards in the draw pile.
10. Reveals one card to initialize the drop pile.
11. Selects the starting player.
12. Starts the round.

The initial drop card does not trigger a Power Card effect, even if it is a 7.

## 4.2 Starting Player

The computer selects the starting player randomly for the first round.

For subsequent rounds, the starting position rotates clockwise among the remaining active players.

All turns proceed clockwise unless a special Power Card rule changes which player acts next.

## 4.3 Deck Configuration After Elimination

The number of decks is determined by the number of active players when a new round begins.

For example, a game starting with six players uses two decks.

If the number of active players later decreases to four, the next round uses one deck.

The deck configuration does not change in the middle of an active round.

---

# 5. Normal Turn Structure

## 5.1 Beginning of a Turn

At the beginning of each normal turn, the player may:

1. Declare Least, provided the hand total is five points or less.
2. Continue with a normal card-playing turn.

A normal turn consists of:

1. Dropping one card or a legal matching group.
2. Drawing one card, unless the matching-drop exception applies.

A player must complete the required actions before the 60-second timer expires.

## 5.2 Dropping Cards

A player may drop:

- One card of any rank.
- Two or more cards of the same rank.

Cards in a matching group may have different suits.

With two decks, duplicate cards are also considered matching when their ranks are the same.

### Legal Drop Examples

- K♠
- 5♥ + 5♣
- 8♠ + 8♥ + 8♦
- Two identical Q♣ cards from separate decks
- Multiple 7s as a single Power Card action

### Illegal Drop Examples

- 3♠ + 5♠
- 4♣ + 5♣ + 6♣
- K♠ + Q♠
- PJ + RJ
- Any unrelated combination of cards

Illegal drops are prohibited and must be blocked by the application.

## 5.3 Drawing a Card

After dropping, the player normally draws exactly one card.

The player may choose between:

**Option A: Draw Pile**

Draw the top card from the face-down draw pile.

**Option B: Open Pickup**

Take one card from the immediately preceding player's latest eligible drop group.

An open pickup is available only when the immediately preceding player has made an eligible drop.

The player may not:

- Take multiple cards from the drop pile.
- Select older dropped cards.
- Retrieve a card they have just dropped.
- Draw from another player's hand.

## 5.4 Matching-Drop Exception

If the player's dropped card or group matches the rank of the visible top drop before their action, they do not draw a replacement card.

This is called **Match and Drop**.

**Example:**

The top drop is 5♥.

The current player holds 5♠ and 5♦.

The player drops both cards.

Since the rank matches the top drop, the player does not draw.

The player's hand is reduced by two cards.

Skipping the draw is mandatory when this exception applies.

A card's zero-point value does not affect its matching rank.

The special Power Card behavior of 7 still applies when a 7 is played.

## 5.5 Changing Hand Size

Players begin each round with seven cards.

The number of cards in a player's hand may change during the round.

Examples:

- Drop one and draw one: No change.
- Drop three and draw one: Hand decreases by two.
- Match and drop two: Hand decreases by two.
- Draw a four-card Power Card penalty: Hand increases by four.

There is no requirement to maintain seven cards after the round begins.

---

# 6. Special Power Card: 7

## 6.1 Overview

The card 7 is a special Power Card.

When a player drops one or more 7s, the next player must respond to a draw penalty instead of taking a normal turn.

The penalty begins at two cards and increases by two cards whenever the next player responds by playing a 7.

The penalty can be transferred repeatedly between consecutive players.

The card 7 always has a hand value of seven points.

It can never become an RJ.

## 6.2 Initiating a 7 Penalty

Consider four players:

**A → B → C → D → A**

Player A drops a 7 during a normal turn.

After completing any drawing action required by that normal turn, the Power Card effect begins.

Player B is now subject to a penalty of two cards.

B must either:

1. Draw two cards and lose their normal turn.
2. Play a 7, if available, to transfer an increased penalty to C.

If B draws two cards:

- B receives exactly two cards.
- B cannot perform any additional normal-turn action.
- The penalty sequence ends.
- Player C takes the next normal turn.

## 6.3 Stacking the Penalty

If Player B plays a 7, the accumulated penalty increases from two to four cards.

Player C must now either:

1. Draw four cards and lose their normal turn.
2. Play a 7 to increase the penalty to six cards for D.

If C plays a 7, Player D must either:

1. Draw six cards and lose their normal turn.
2. Play a 7 to complete a full cycle.

Each consecutive 7 action increases the penalty by exactly two cards.

| Consecutive 7 Actions | Accumulated Penalty |
|---|---|
| A plays 7 | 2 cards |
| B plays 7 | 4 cards |
| C plays 7 | 6 cards |
| D plays 7 | Full-cycle exception |

## 6.4 Full-Cycle Exception

A Full Cycle occurs when every active player consecutively plays at least one 7 during the same uninterrupted Power Card sequence.

For example, with four players:

1. A plays a 7.
2. B responds with a 7.
3. C responds with a 7.
4. D responds with a 7.

Every player has now participated in the sequence.

The following rules apply:

- The accumulated penalty is cancelled.
- No player draws penalty cards.
- The Power Card sequence ends.
- Player A, who originally initiated the sequence, receives the next normal turn.

This applies regardless of the number of active players.

For two players, two consecutive players must play a 7.

For eight players, all eight must play a 7 in an uninterrupted sequence.

## 6.5 Multiple 7s in One Action

A player may drop more than one 7 in a single action.

However, the number of cards dropped does not multiply the Power Card effect.

Examples:

- One 7 played: Adds two penalty cards.
- Two 7s played together: Adds two penalty cards.
- Three 7s played together: Adds two penalty cards.

A multiple-7 drop counts as one Power Card action by one player.

The Full-Cycle Exception requires participation by every active player, not a specific number of physical 7 cards.

## 6.6 Choices During a 7 Sequence

While responding to an active penalty:

1. The player may play only one or more cards of rank 7.
2. The player may instead draw the accumulated penalty.
3. A player holding a 7 is not required to play it.
4. PJ cannot replace a 7.
5. RJ cannot replace a 7.
6. A normal drop is not permitted.
7. Least cannot be declared.
8. Drawing the penalty immediately ends the sequence.
9. The player who draws the penalty loses their normal turn.
10. The next active player then takes a normal turn.

If a player has no 7, the application automatically applies the accumulated draw penalty and advances the turn.

If a player has a 7, the application presents the two available choices, with the normal 60-second action timer.

## 6.7 Timer Expiry During a 7 Sequence

The same 60-second limit applies to a player deciding whether to play a 7 or draw the penalty.

If the player fails to make the required choice before the timer expires:

- The player is immediately eliminated.
- Their cards are removed from active play without being revealed.
- The current penalty sequence is cancelled.
- The next active player receives a normal turn.

If only one active player remains after the elimination, that player wins the game.

---

# 7. Calling Least

## 7.1 Least Eligibility

A player may declare **Least** only when the total value of the cards in their hand is five points or less.

The eligible range is:

**0 ≤ Hand Total ≤ 5**

Least is available only at the beginning of the player's normal turn, before dropping or drawing.

A player cannot declare Least:

- When their hand value exceeds five.
- After already performing a normal-turn action.
- During another player's turn.
- While responding to an active 7 penalty.
- After their 60-second turn timer expires.

The application automatically calculates the player's hand value and enables Least only when the conditions are satisfied.

## 7.2 Least Resolution

When a player declares Least:

1. The round ends immediately.
2. No additional cards may be dropped or drawn.
3. The computer calculates the value of each player's remaining hand.
4. The caller's total is compared with the totals of all other active players.
5. The computer determines whether the Least is successful.
6. Round penalty points are awarded.
7. Cumulative scores are updated.
8. Eliminations are processed.

**Players' hands are never revealed to opponents during this process.**

Only hand totals, Least results, and awarded penalty points are displayed.

## 7.3 Successful Least

A Least is successful only if the caller has a strictly lower total than every other active player.

For example:

| Player | Hand Total | Result |
|---|---|---|
| A, calls Least | 3 | Successful |
| B | 7 | Higher |
| C | 12 | Higher |
| D | 5 | Higher |

A has the unique lowest total.

The Least succeeds.

## 7.4 Unsuccessful Least

A Least is unsuccessful if at least one other active player has a total equal to or lower than the caller.

For example:

| Player | Hand Total | Result |
|---|---|---|
| A, calls Least | 4 | Unsuccessful |
| B | 2 | Lower than A |
| C | 10 | Higher |
| D | 8 | Higher |

Player A's Least fails because Player B has fewer points.

A tie also causes the Least to fail.

## 7.5 Least With an Empty Hand

It is possible for a player to drop all their cards using the matching-drop rule.

An empty hand has a value of zero.

The player must wait until the beginning of their next normal turn to declare Least.

An empty hand does not automatically end the round.

If another player calls Least before that player's next turn, the empty hand is still worth zero and is included in the hand-total comparison.

If multiple players have zero points, a Least may fail because of a tie.

---

# 8. Round Scoring

## 8.1 Successful Least

If the caller has the unique lowest hand total:

- The caller receives zero round penalty points.
- Every other active player receives penalty points equal to their remaining hand total.

**Example:**

| Player | Hand Total | Round Penalty |
|---|---|---|
| A, Least | 4 | 0 |
| B | 8 | 8 |
| C | 15 | 15 |
| D | 6 | 6 |

The points are added to each player's cumulative score.

## 8.2 Unsuccessful Least

If the caller does not have the unique lowest hand total:

- The caller receives a fixed penalty of 40 points.
- The opponent or opponents with the lowest hand total receive zero points.
- All other opponents receive penalty points equal to their remaining hand totals.

The 40-point penalty replaces the caller's hand value. It is not added on top of that value.

**Example:**

| Player | Hand Total | Round Penalty |
|---|---|---|
| A, Least | 5 | 40 |
| B | 3 | 0 |
| C | 12 | 12 |
| D | 9 | 9 |

## 8.3 Tied Lowest Hands

If two or more opponents share the lowest hand total during an unsuccessful Least, all those lowest-scoring opponents receive zero round penalty points.

The caller still receives 40 points.

For example:

| Player | Hand Total | Round Penalty |
|---|---|---|
| A, Least | 4 | 40 |
| B | 4 | 0 |
| C | 4 | 0 |
| D | 9 | 9 |

---

# 9. Turn Timer and Time-Based Elimination

## 9.1 Turn Duration

Every player has a maximum of **60 seconds** to complete their required turn action.

The countdown begins when the application enables the player to act.

The remaining time must be prominently displayed.

## 9.2 Completing a Turn

A normal turn is considered complete when the player has:

1. Made a legal drop.
2. Completed any required card draw.

A successful Least declaration completes the player's action immediately.

A player responding to a 7 penalty completes the action by either playing a legal 7 or drawing the accumulated penalty.

## 9.3 Timer Expiry

If the player fails to complete their turn within 60 seconds:

**The player is immediately eliminated from the game.**

The following rules apply:

1. No additional time is granted.
2. No automatic move is made on the player's behalf.
3. The player is removed from the current game.
4. Their hand is removed without being revealed.
5. The current turn is cancelled.
6. The game advances to the next active player.
7. The player's existing score is retained in the match history.
8. The eliminated player cannot rejoin the same game.

Elimination occurs regardless of the player's cumulative score.

## 9.4 Timer During Special Actions

The 60-second limit also applies when the player must make a choice during a 7 Power Card sequence.

If no decision is required because the player has no 7, the application automatically processes the penalty draw instead of waiting for the countdown.

## 9.5 Timer Handling

The timer is managed by the game system.

- Only one player has an active action timer at a time.
- Each new turn begins with a fresh 60-second countdown.
- The timer cannot be paused by the player.
- Invalid actions do not restart the timer.
- The timer must remain consistent across all connected clients.
- Disconnecting or refreshing the browser does not reset the timer.

If the game is played online, the server determines the authoritative remaining time and whether elimination has occurred.

---

# 10. Player Elimination

## 10.1 Elimination by Score

The default cumulative score threshold is **100 points**.

Players are eliminated when their cumulative score reaches or exceeds 100.

Examples:

- 99 points: Active
- 100 points: Eliminated
- 105 points: Eliminated

The elimination threshold will later be configurable in the game settings menu.

Until that feature is implemented, the default remains 100 points.

## 10.2 Elimination by Timeout

A player is eliminated immediately if they fail to complete a required turn within 60 seconds.

This applies even if their cumulative score is zero.

## 10.3 Effect of Elimination

When a player is eliminated:

1. Their status changes to Eliminated.
2. Their cards are removed from active play.
3. Their hand remains concealed.
4. They are excluded from future turns.
5. They are excluded from future dealing.
6. Their cumulative score remains visible in the match history.
7. The remaining players continue the game.

If a player is eliminated during a round, the current deck configuration remains unchanged until the next round.

## 10.4 Winning the Game

The game continues until only one active player remains.

That player is declared the winner.

If all remaining players reach the score-elimination threshold after the same round, the player with the lowest resulting cumulative score wins.

If those lowest cumulative scores are tied, the tied players participate in an additional tiebreaker round.

The tiebreaker uses the standard gameplay rules, without applying the cumulative score-elimination threshold. If the resulting round scores are tied, another tiebreaker round is played.

---

# 11. Illegal Moves and Action Validation

## 11.1 Illegal Moves Are Not Permitted

The application must prevent illegal gameplay actions.

Players cannot submit an illegal move and then reverse it after execution.

All actions are validated before being accepted and applied to the game state.

## 11.2 Invalid Drops

The following actions must be rejected:

- Dropping cards with different ranks in one group.
- Dropping cards not owned by the player.
- Dropping cards during another player's turn.
- Dropping normal cards while responding to a 7 penalty.
- Performing multiple independent drop actions during a single normal turn.
- Dropping after Least has been declared.
- Attempting a move after elimination.

## 11.3 Invalid Draws

The application must prevent:

- Drawing before the required drop.
- Drawing more cards than permitted.
- Taking an old buried drop.
- Drawing during a matching-drop turn.
- Drawing after an action has already been completed.
- Taking cards from another player's hand.

## 11.4 Invalid Least Attempts

The Least action must be disabled if:

- The player's hand total is greater than five.
- It is not the player's normal turn.
- The player has already started a normal-turn action.
- A 7 penalty is awaiting that player's response.
- The player has been eliminated.

## 11.5 Handling Rejected Actions

When a player attempts an invalid action:

1. The action is rejected.
2. The game state remains unchanged.
3. An explanatory message may be displayed.
4. The 60-second timer continues normally.

Repeated invalid attempts do not provide additional time.

---

# 12. Hand Privacy and Information Visibility

## 12.1 Private Hands

Players may view only their own cards.

Other players' hands must remain concealed throughout the entire game.

The interface must not offer an option to reveal, share, or display a player's full hand to opponents.

## 12.2 Least Privacy

Declaring Least does not reveal the individual cards held by any player.

The computer privately evaluates the hands and displays only:

- Each player's calculated hand total
- Whether the Least succeeded or failed
- Round penalty points
- Updated cumulative scores
- Elimination results

The individual cards used to calculate those totals remain hidden.

## 12.3 Spectators

If spectator functionality is introduced later, spectators must not be allowed to inspect active players' hands.

Spectators may observe the public game state, including played cards and scoring information, but not private cards.

## 12.4 Server-Side Enforcement

For online multiplayer, the game server must be responsible for maintaining the authoritative game state.

Private cards belonging to one player must not be transmitted to another player's browser.

The server validates actions and calculates hand totals, Least results, scoring, and eliminations.

Visual restrictions alone are insufficient to protect private hands.

---

# 13. Special Situations

## 13.1 Draw Pile Exhaustion

If the draw pile becomes empty, the computer reshuffles older dropped cards to create a new draw pile.

The following cards remain excluded from reshuffling:

- The current RJ indicator
- Cards currently held by players
- The latest drop group that is still eligible for pickup

If no recyclable cards remain and a required draw cannot be completed, the round ends through an automatic hand-total settlement.

The player or players with the lowest hand total receive zero round points.

All other active players receive their actual hand totals as round penalty points.

Individual hands remain concealed.

## 13.2 Insufficient Cards for a 7 Penalty

If the accumulated penalty requires more cards than are available, the application first replenishes the draw pile using eligible older dropped cards.

If the required penalty still cannot be completed, the remaining available cards are drawn and the round ends through the draw-pile exhaustion procedure.

## 13.3 Player Disconnects

A disconnected player remains subject to the active 60-second timer.

If the player reconnects before the timer expires, they may continue their pending action.

If the timer expires, the player is eliminated.

## 13.4 Timeout During a Power Card Sequence

If a player is eliminated while responding to a 7 penalty:

- The pending penalty is cancelled.
- The eliminated player is removed.
- The next active player receives a normal turn.

The remaining players do not inherit the cancelled penalty.

## 13.5 Initial Drop Is a 7

If the initial drop revealed by the computer is a 7, no Power Card penalty is triggered.

The 7 acts as the visible top drop rank until the first player makes a move.

If the first player legally drops a 7, the normal 7 Power Card rule is triggered.

## 13.6 Card Ownership and Duplicate Cards

When two decks are used, physically identical cards may occur.

The application must assign a unique internal identity to each physical card.

Cards with the same rank remain eligible for matching-rank drops, even when their suits and printed appearances are identical.

---

# 14. End of a Round

A round ends when:

1. A valid Least is declared and evaluated.
2. The draw pile cannot support a required draw after all eligible recycling is completed.
3. Only one active player remains because of elimination.

At the end of a round, the computer:

1. Calculates the appropriate round scores.
2. Updates cumulative scores.
3. Identifies players who reached the score-elimination threshold.
4. Eliminates those players.
5. Checks whether the game has a winner.
6. Collects all cards, including the RJ indicator.
7. Determines the number of decks required for the next round.
8. Shuffles the deck.
9. Selects a new RJ.
10. Deals seven cards to each remaining player.
11. Determines the next starting player.
12. Begins the next round.

No player is required to collect cards, deal cards, or calculate scores manually.

---

# 15. Gameplay Examples

## Example 1: Normal Turn

Player A holds:

K♠, 8♥, 6♣, 4♦, 3♣, 2♠, A♥.

The current top drop is 9♦.

A drops K♠.

Since K♠ does not match the top drop rank, A draws one card.

A's turn ends.

## Example 2: Matching-Card Drop

The current top drop is 6♥.

Player B holds 6♣ and 6♦.

B drops both cards.

Because the dropped rank matches the current top drop, no replacement card is drawn.

B's hand decreases by two cards.

## Example 3: Successful Least

The RJ rank is 9.

Player A holds:

9♣, A♦, 3♥.

The total is:

0 + 1 + 3 = 4.

A calls Least at the beginning of their turn.

The opponents have totals of 6, 11, and 15.

A has the unique lowest total.

The Least succeeds.

A receives zero round penalty points.

## Example 4: Unsuccessful Least

Player A has a hand total of 5 and calls Least.

Player B has a hand total of 3.

Since B has a lower total, A's Least fails.

A receives 40 penalty points.

B receives zero round points.

The other players receive points equal to their hand totals.

## Example 5: Stacking 7s

Four players are playing clockwise.

- A plays 7.
- B responds with 7.
- C responds with 7.
- D does not play a 7.

D must draw six cards.

D loses their normal turn.

A receives the next normal turn.

## Example 6: Full Cycle of 7s

Four players are playing clockwise.

- A plays 7.
- B plays 7.
- C plays 7.
- D plays 7.

All four players participated in the uninterrupted sequence.

The accumulated penalty is cancelled.

No one draws penalty cards.

A receives the next normal turn.

## Example 7: Turn Timeout

Player C begins a normal turn with 60 seconds available.

C does not complete a legal turn before the countdown reaches zero.

C is eliminated immediately.

Their cards remain hidden.

D receives the next turn, assuming D is the next active player.

## Example 8: Score Elimination

The cumulative scores after a round are:

| Player | Cumulative Score | Status |
|---|---|---|
| A | 55 | Active |
| B | 101 | Eliminated |
| C | 88 | Active |
| D | 73 | Active |

B is removed from subsequent rounds.

The game continues with A, C, and D.

---

# 16. Default Game Settings

The following settings define the standard Least Count game.

| Parameter | Default Value |
|---|---|
| Minimum players | 2 |
| Maximum players | 8 |
| Initial hand size | 7 cards |
| Decks for 2 to 4 players | 1 |
| Decks for 5 to 8 players | 2 |
| Printed Jokers per deck | 1 |
| RJ selection | Random every round |
| Rank 7 eligible as RJ | No |
| PJ eligible as RJ | No |
| Physical RJ indicator | Removed from playable deck |
| RJ point value | 0 |
| PJ point value | 0 |
| Normal rank 7 value | 7 |
| Power Card | 7 |
| Initial Power Card penalty | 2 cards |
| Stacking increment | 2 cards per 7 action |
| Multiple 7s per action | Allowed |
| Full-cycle cancellation | Enabled |
| Least eligibility threshold | 5 or fewer points |
| Successful Least | Caller scores 0 |
| Failed Least penalty | 40 points |
| Score-elimination threshold | 100 points |
| Turn duration | 60 seconds |
| Timeout consequence | Immediate elimination |
| Illegal drops | Blocked |
| Revealing private hands | Prohibited |
| Turn direction | Clockwise |
| Card dealing | Automatic |
| Dealer | None |
| Winner | Last active player |

The elimination score threshold will be configurable in a future game settings menu.

---

# 17. Quick-Start Guide

1. **Join a game.** Two to eight players can participate.

2. **Receive cards.** The computer automatically deals seven cards to every player.

3. **Check the RJ.** The computer selects a random rank, excluding 7. Every remaining card of that rank is worth zero.

4. **Play your turn.** Drop one card or a group of matching cards, then draw one replacement card unless the matching-drop exception applies.

5. **Use 7s strategically.** Playing a 7 forces the next player to draw two cards or respond with another 7. Consecutive 7s increase the penalty. A complete cycle cancels the penalty.

6. **Declare Least.** When your hand total is five points or less, you may declare Least at the beginning of your normal turn.

7. **Score the round.** A successful Least gives the caller zero points. A failed Least gives the caller 40 penalty points.

8. **Watch the timer.** Complete each turn within 60 seconds or be eliminated.

9. **Avoid elimination.** Players reaching 100 cumulative points are eliminated.

10. **Win the game.** The last active player is the winner.

---

**End of Least Count Rulebook, Edition 2.0 Working Draft.**
