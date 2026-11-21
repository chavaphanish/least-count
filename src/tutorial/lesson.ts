import { applyAction, createGame, latestGroup, TURN_MS } from '../game/engine'
import type { Action, GameState } from '../game/engine'
import { assembleDeck, handTotal } from '../game/deck'
import type { GameRank } from '../game/deck'

type Input = 'next' | 'drop' | 'draw' | 'pickup' | 'declare' | 'watch' | 'timer' | 'ready' | 'finish'
export type Frame = { step: number; text: string; game: GameState; input: Input; ids: string[] }
function deal(alternate = false) {
  const deck = assembleDeck(3)
  function take(rank: GameRank) {
    const index = deck.findIndex(card => card.rank === rank)
    if (index < 0) throw new Error(`Missing tutorial card: ${rank}`)
    return deck.splice(index, 1)[0]
  }
  const game = createGame(['You', 'Sam', 'Alex'], 0, () => .45)
  const indicator = take('5')
  if (indicator.rank === 'PJ') throw new Error('Invalid indicator')
  game.indicator = indicator
  const hands: GameRank[][] = alternate ? [['A', 'PJ'], ['K','Q','9'], ['2','2']] :
    [['K','8','8','7','5','PJ','A'], ['9','8','K','Q','J','10','9'], ['8','7','5','Q','K','J','10']]
  game.players.forEach((player,i) => { player.hand = hands[i].map(take) })
  game.discards = [[take('3')]]
  game.eligible = latestGroup(game).map(c => c.id)
  // pop() draws the rightmost card first.
  const draws = (['A','Q','K','J','10','9','6','Q','J','10','9'] as GameRank[]).map(take)
  game.drawPile = [...deck,...draws.reverse()]
  game.phase = 'turn'
  game.current = game.starter = alternate ? 2 : 0
  game.sevens = null
  game.deadline = TURN_MS
  game.events = []; game.log = []; game.eventSequence = 0
  return game
}

// Each frame keeps the engine state before its interaction. Replay never touches a saved match.
export function buildLesson() {
  let game = deal(), time = 0
  const frames: Frame[] = []
  const frame = (step: number, text: string, input: Input = 'next', ids: string[] = []) =>
    frames.push({step,text,input,ids,game})
  const act = (action: Action) => { game = applyAction(game, action, ++time, () => .45) }
  function drop(step: number, rank: GameRank, text: string, human = false) {
    const player = game.players[game.current]
    const ids = player.hand.filter(card => card.rank === rank).map(card => card.id)
    frame(step,text,human ? 'drop' : 'watch',ids)
    act({type:'discard', playerId:player.id, cardIds:ids})
  }
  function draw(step: number, text: string, human = false) {
    frame(step,text,human ? 'draw' : 'watch')
    act({type:'draw', playerId:game.players[game.current].id, source:'pile'})
  }
  frame(1,'Welcome to YAYDU! Your goal is to finish with the lowest score. Each player starts with seven cards.')
  frame(1,'Find your hand below the piles. The turn marker and clock show who plays next. Everyone starts at 0 penalty points.')
  frame(2,'Count your hand: Aces are 1, face cards are 10, and number cards use their rank. The round’s 5s and the Printed Joker are worth 0.')
  drop(3,'K','Select your King and drop it. You may drop one card or several of the same rank.',true)
  draw(3,'Now tap the Draw Pile for a replacement. Watch your hand total change.',true)
  drop(3,'9','Sam drops matching 9s.')
  draw(3,'Sam draws a replacement.')
  drop(3,'8','Alex drops an 8.')
  draw(3,'Alex draws a replacement.')
  drop(4,'8','Select both 8s, then drop them together. Matching the top 8 ends your turn without a replacement.',true)
  drop(4,'8','Sam also matches the top 8.')
  frame(5,'A 7 forces the next player to draw two cards, unless they respond with another 7!')
  drop(5,'7','Alex plays a 7. Watch the penalty move to you.')
  drop(5,'7','Play your 7 to stack the penalty to four. This ends your turn immediately.',true)
  frame(5,'Sam had no 7, drew four cards and lost the turn. A 7 can come from the closed Draw Pile, but never from the open Drop Pile.')
  drop(6,'5','Alex drops a zero-point 5. The Round Joker changes each round and can never be a 7.')
  drop(6,'PJ','Select and drop the Printed Joker. Both joker types score zero and follow the normal drop rules.',true)
  frame(6,'Pick up Alex’s eligible 5. Its rank matches the Round Joker, so it adds zero points.','pickup')
  act({type:'draw',playerId:'p0',source:'discard',cardId:game.eligible[0]})
  frame(7,'Watch Sam’s accelerated clock. A timeout forfeits this round and adds 40 penalty points.','timer')
  time = game.deadline!
  act({type:'timeout'})
  frame(7,'Sam can return next round because 40 is below this game’s 100-point cutoff.')
  drop(8,'J','Alex drops a Jack.')
  if (game.phase === 'draw') draw(8,'Alex takes a replacement.')
  frame(8,'Your total is at most 5. Declare Least at the start of your turn if you think your hand is lowest.','declare')
  act({type:'show',playerId:'p0'})
  const points = handTotal(game.players[0].hand,game.indicator.rank)
  const alexTotal = game.result!.scores.find(score => score.id === 'p2')!.total
  frame(9,`You declared a least count of ${points} and won the round! Alex held ${alexTotal} points and receives the maximum penalty of 40. Sam keeps the timeout penalty.`)
  game = deal(true); time = 0
  frame(10,'Alternate scenario replay: Alex declares with 4 points. Your Ace and Printed Joker total only 1.','watch')
  act({type:'show',playerId:'p2'})
  frame(10,'Alex declared a least count of 4 and failed! Alex receives +40. Everyone else receives +0.')
  frame(11,'Sam is ready. Click Next Round to ready up. Alex, the host, can then start Round 2.','ready')
  frame(11,'2/2 Players Ready · Alex starts Round 2.','watch')
  act({type:'next-round'})
  frame(11,'At the cutoff, a player is eliminated. Scores carry forward until only one player remains and wins.')
  frame(11,"You're ready to play YAYDU! Seven cards. One goal. Lowest score wins!",'finish')
  return frames
}
