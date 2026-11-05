import type { Card } from './cards'
import { shuffleDeck } from './cards'
import { handTotal, prepareDeck } from './deck'
import type { GameCard, GameRank } from './deck'

export const TURN_MS = 60_000
export const ELIMINATION_SCORE = 100
export type Phase = 'turn' | 'draw' | 'penalty' | 'round-over' | 'game-over'
export type Player = {
  id: string
  name: string
  hand: GameCard[]
  score: number
  eliminated: boolean
  eliminationReason?: 'score' | 'timeout'
}
export type RoundScore = {
  id: string
  name: string
  total: number
  penalty: number
  score: number
  eliminated: boolean
}
export type RoundResult = {
  reason: 'show' | 'exhaustion' | 'last-player'
  caller?: string
  successful?: boolean
  winners: string[]
  scores: RoundScore[]
}
export type GameState = {
  version: 1
  players: Player[]
  phase: Phase
  round: number
  starter: number
  current: number
  indicator: Card
  drawPile: GameCard[]
  discards: GameCard[][]
  eligible: string[]
  discardedRank: GameRank | null
  sevens: { initiator: number; participants: number[]; amount: number } | null
  deadline: number | null
  result: RoundResult | null
  log: string[]
}
export type Action =
  | { type: 'discard'; playerId: string; cardIds: string[] }
  | {
      type: 'play-turn'
      playerId: string
      cardIds: string[]
      source: 'pile' | 'discard'
      cardId?: string
    }
  | {
      type: 'draw'
      playerId: string
      source: 'pile' | 'discard'
      cardId?: string
    }
  | { type: 'show'; playerId: string }
  | { type: 'accept-penalty'; playerId: string }
  | { type: 'timeout' }
  | { type: 'next-round' }

export class RuleError extends Error {}
const active = (s: GameState) => s.players.filter((p) => !p.eliminated)
export const latestGroup = (s: GameState): GameCard[] => s.discards.at(-1) ?? []
export const pickupCards = (s: GameState): GameCard[] =>
  s.discards.flat().filter((c) => s.eligible.includes(c.id))
export const isPlaying = (s: GameState) =>
  ['turn', 'draw', 'penalty'].includes(s.phase)
export const canShow = (s: GameState, playerId: string) =>
  s.phase === 'turn' &&
  s.players[s.current].id === playerId &&
  !s.players[s.current].eliminated &&
  handTotal(s.players[s.current].hand, s.indicator.rank) <= 5

/** Validate a selection without changing the hand, pile, timer, or random source. */
export function inspectDiscard(
  s: GameState,
  playerId: string,
  cardIds: string[],
) {
  const player = s.players[s.current]
  if (player.id !== playerId || player.eliminated)
    throw new RuleError('Wait for your turn.')
  if (s.phase !== 'turn' && s.phase !== 'penalty')
    throw new RuleError('Draw your replacement card first.')
  if (!player.hand.length)
    throw new RuleError(
      'Your hand is empty. You must call Show on your normal turn.',
    )
  if (!cardIds.length || new Set(cardIds).size !== cardIds.length) {
    throw new RuleError('Select one or more different cards from your hand.')
  }
  const cards = cardIds.map((id) => player.hand.find((c) => c.id === id))
  if (cards.some((c) => !c))
    throw new RuleError('You can only discard cards in your own hand.')
  const group = cards as GameCard[]
  const rank = group[0].rank
  if (!group.every((c) => c.rank === rank))
    throw new RuleError('All selected cards must have the same rank.')
  if (s.phase === 'penalty' && rank !== '7')
    throw new RuleError('Play one or more 7s, or accept the penalty.')
  const matchesTop = latestGroup(s).at(-1)?.rank === rank
  return {
    cards: group,
    rank,
    matchesTop,
    needsDraw: s.phase === 'turn' && !matchesTop,
  }
}

function note(s: GameState, text: string) {
  s.log = [...s.log.slice(-39), text]
}
function nextActive(s: GameState, after: number): number {
  for (let step = 1; step <= s.players.length; step++) {
    const index = (after + step) % s.players.length
    if (!s.players[index].eliminated) return index
  }
  throw new RuleError('No active player remains.')
}

function lastPlayerWins(s: GameState): boolean {
  const survivors = active(s)
  if (survivors.length !== 1) return false
  s.phase = 'game-over'
  s.deadline = null
  s.sevens = null
  s.result = { reason: 'last-player', winners: [survivors[0].id], scores: [] }
  note(s, `${survivors[0].name} wins the match.`)
  return true
}

function settle(
  s: GameState,
  reason: 'show' | 'exhaustion',
  callerId?: string,
) {
  const players = active(s)
  const totals = players.map((p) => handTotal(p.hand, s.indicator.rank))
  const callerIndex = players.findIndex((p) => p.id === callerId)
  const minimum = Math.min(...totals)
  const successful =
    callerIndex >= 0 &&
    (totals[callerIndex] === 0 ||
      totals.every(
        (total, index) => index === callerIndex || total > totals[callerIndex],
      ))
  const opponentMinimum = Math.min(
    ...totals.filter((_, index) => index !== callerIndex),
  )
  const winners: string[] = []
  const scores = players.map((player, index) => {
    let penalty: number
    if (reason === 'exhaustion')
      penalty = totals[index] === minimum ? 0 : totals[index]
    else if (successful)
      penalty = index === callerIndex || totals[index] === 0 ? 0 : totals[index]
    else
      penalty =
        index === callerIndex
          ? 40
          : totals[index] === opponentMinimum
            ? 0
            : totals[index]
    if (penalty === 0) winners.push(player.id)
    player.score += penalty
    if (player.score >= ELIMINATION_SCORE) {
      player.eliminated = true
      player.eliminationReason = 'score'
      player.hand = []
    }
    return {
      id: player.id,
      name: player.name,
      total: totals[index],
      penalty,
      score: player.score,
      eliminated: player.eliminated,
    }
  })
  s.result = {
    reason,
    caller: callerId,
    successful: reason === 'show' ? successful : undefined,
    winners,
    scores,
  }
  s.phase = active(s).length === 1 ? 'game-over' : 'round-over'
  s.deadline = null
  s.sevens = null
  s.discardedRank = null
  note(
    s,
    reason === 'exhaustion'
      ? 'No recyclable cards remain. Round settled by hand totals.'
      : `${players[callerIndex].name} called Show: ${successful ? 'lowest hand (zero-point ties allowed)' : 'unsuccessful, 40 penalty points'}.`,
  )
}

/** Draw only from the closed pile; protect the current group and pending open pickup. */
function drawCards(
  s: GameState,
  player: Player,
  count: number,
  random: () => number,
): boolean {
  for (let drawn = 0; drawn < count; drawn++) {
    if (s.drawPile.length === 0) {
      const protectedIds = new Set([
        ...latestGroup(s).map((c) => c.id),
        ...s.eligible,
      ])
      const recyclable = s.discards
        .flat()
        .filter((c) => !protectedIds.has(c.id))
      s.discards = s.discards
        .map((group) => group.filter((c) => protectedIds.has(c.id)))
        .filter((group) => group.length)
      s.drawPile = shuffleDeck(recyclable, random)
      if (s.drawPile.length)
        note(s, 'Older discards were reshuffled into the draw pile.')
    }
    const card = s.drawPile.pop()
    if (!card) {
      settle(s, 'exhaustion')
      return false
    }
    player.hand.push(card)
  }
  return true
}

function beginTurn(
  s: GameState,
  index: number,
  now: number,
  random: () => number,
) {
  s.current = index
  s.discardedRank = null
  if (lastPlayerWins(s)) return
  s.phase = s.sevens ? 'penalty' : 'turn'
  s.deadline = now + TURN_MS
  const player = s.players[index]
  if (s.sevens && !player.hand.some((c) => c.rank === '7')) {
    acceptPenalty(s, now, random)
  }
}

function acceptPenalty(s: GameState, now: number, random: () => number) {
  const player = s.players[s.current]
  const amount = s.sevens!.amount
  if (!drawCards(s, player, amount, random)) return
  note(
    s,
    `${player.name} drew the ${amount}-card penalty and lost their normal turn.`,
  )
  s.eligible = []
  s.sevens = null
  beginTurn(s, nextActive(s, s.current), now, random)
}

function finishNormalTurn(s: GameState, now: number, random: () => number) {
  s.eligible = latestGroup(s).map((c) => c.id)
  if (s.discardedRank === '7') {
    s.sevens = { initiator: s.current, participants: [s.current], amount: 2 }
    note(s, '7 penalty started: 2 cards.')
  }
  beginTurn(s, nextActive(s, s.current), now, random)
}

function startRound(s: GameState, now: number, random: () => number) {
  const { cards, indicator } = prepareDeck(active(s).length, random)
  s.indicator = indicator
  s.drawPile = cards
  for (const player of s.players) {
    player.hand = player.eliminated ? [] : s.drawPile.splice(-7)
  }
  s.discards = [[s.drawPile.pop()!]]
  s.eligible = [] // The initial card was not discarded by a preceding player.
  s.sevens = null // An initial 7 never starts a penalty.
  s.result = null
  note(
    s,
    `Round ${s.round}: seven cards each; selected joker rank ${indicator.rank}.`,
  )
  beginTurn(s, s.starter, now, random)
}

export function createGame(
  names: string[],
  now = Date.now(),
  random = Math.random,
): GameState {
  if (
    names.length < 2 ||
    names.length > 8 ||
    names.some((name) => !name.trim())
  ) {
    throw new RuleError('A game requires 2–8 named players.')
  }
  const starter = shuffleDeck(
    names.map((_, index) => index),
    random,
  )[0]
  const s: GameState = {
    version: 1,
    players: names.map((name, index) => ({
      id: `p${index}`,
      name: name.trim(),
      hand: [],
      score: 0,
      eliminated: false,
    })),
    phase: 'turn',
    round: 1,
    starter,
    current: starter,
    indicator: { id: '', rank: 'A', suit: 'clubs' },
    drawPile: [],
    discards: [],
    eligible: [],
    discardedRank: null,
    sevens: null,
    deadline: null,
    result: null,
    log: [],
  }
  startRound(s, now, random)
  return s
}

/** Immutable reducer: validation failures throw without changing the supplied state. */
export function applyAction(
  state: GameState,
  action: Action,
  now = Date.now(),
  random = Math.random,
): GameState {
  const s = structuredClone(state)
  if (action.type === 'next-round') {
    if (s.phase !== 'round-over')
      throw new RuleError('The round has not finished, or the match is over.')
    s.starter = nextActive(s, s.starter)
    s.round++
    startRound(s, now, random)
    return s
  }
  if (!isPlaying(s)) throw new RuleError('This round has ended.')
  // A late click cannot evade a deadline, including after a page reload.
  if (s.deadline !== null && now >= s.deadline) {
    const player = s.players[s.current]
    player.eliminated = true
    player.eliminationReason = 'timeout'
    player.hand = []
    s.eligible = []
    s.sevens = null
    note(
      s,
      `${player.name} was eliminated by timeout. Pickup eligibility and any 7 penalty were cleared.`,
    )
    beginTurn(s, nextActive(s, s.current), now, random)
    return s
  }
  if (action.type === 'timeout')
    throw new RuleError('The turn deadline has not expired.')
  const player = s.players[s.current]
  if (action.playerId !== player.id || player.eliminated)
    throw new RuleError('Wait for your turn.')
  if (action.type === 'play-turn') {
    if (s.phase !== 'turn')
      throw new RuleError('A combined turn must start before discarding.')
    if (!inspectDiscard(s, action.playerId, action.cardIds).needsDraw) {
      throw new RuleError(
        'Match and Drop requires a discard without a replacement draw.',
      )
    }
    // Both steps validate before anything is returned or persisted. A rejected
    // pickup cannot leave a partial discard behind. Both use the same deadline.
    const discarded = applyAction(
      state,
      {
        type: 'discard',
        playerId: action.playerId,
        cardIds: action.cardIds,
      },
      now,
      random,
    )
    return applyAction(
      discarded,
      {
        type: 'draw',
        playerId: action.playerId,
        source: action.source,
        cardId: action.cardId,
      },
      now,
      random,
    )
  } else if (action.type === 'show') {
    if (!canShow(s, player.id))
      throw new RuleError(
        'Show requires a total of 5 or less at the start of a normal turn.',
      )
    settle(s, 'show', player.id)
  } else if (action.type === 'accept-penalty') {
    if (s.phase !== 'penalty' || !s.sevens)
      throw new RuleError('There is no pending 7 penalty.')
    acceptPenalty(s, now, random)
  } else if (action.type === 'discard') {
    const {
      cards: group,
      rank,
      matchesTop,
    } = inspectDiscard(s, action.playerId, action.cardIds)
    player.hand = player.hand.filter((c) => !action.cardIds.includes(c.id))
    s.discards.push(group)
    note(
      s,
      `${player.name} discarded ${group.length} × ${rank}${matchesTop && s.phase === 'turn' ? ' — Match and Drop, no draw' : ''}.`,
    )
    if (s.phase === 'penalty') {
      s.eligible = group.map((c) => c.id)
      s.sevens!.participants.push(s.current)
      s.sevens!.amount += 2
      if (s.sevens!.participants.length === active(s).length) {
        const initiator = s.sevens!.initiator
        s.sevens = null
        note(
          s,
          'Full cycle of 7s: penalty cancelled. Initiator takes the next normal turn.',
        )
        beginTurn(s, initiator, now, random)
      } else beginTurn(s, nextActive(s, s.current), now, random)
    } else {
      s.discardedRank = rank
      if (matchesTop) finishNormalTurn(s, now, random)
      else s.phase = 'draw' // The deadline is deliberately unchanged.
    }
  } else if (action.type === 'draw') {
    if (s.phase !== 'draw')
      throw new RuleError(
        'Discard first. Match and Drop does not allow a replacement draw.',
      )
    if (action.source === 'discard') {
      const card = pickupCards(s).find((c) => c.id === action.cardId)
      if (!card)
        throw new RuleError(
          'Choose one card from the preceding eligible group, not your own discard.',
        )
      player.hand.push(card)
      s.discards = s.discards
        .map((group) => group.filter((c) => c.id !== card.id))
        .filter((group) => group.length)
      note(s, `${player.name} picked up ${card.rank} from the preceding group.`)
    } else {
      if (!drawCards(s, player, 1, random)) return s
      note(s, `${player.name} drew one card from the draw pile.`)
    }
    finishNormalTurn(s, now, random)
  }
  return s
}
