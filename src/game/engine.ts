import type { Card } from './cards'
import { shuffleDeck } from './cards'
import { handTotal, prepareDeck } from './deck'
import type { GameCard, GameRank } from './deck'
import { formatGameEvent, gameEvents, HISTORY_LIMIT } from './events'
import type { GameEvent, GameEventData, EventPlayer } from './events'

export const TURN_MS = 60_000
export const ELIMINATION_SCORE = 100
export type GameSettings = { eliminationThreshold: number; timedGame: boolean }
export const gameSettings = (s: GameState): GameSettings =>
  s.settings ?? { eliminationThreshold: ELIMINATION_SCORE, timedGame: true }
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
  settings?: GameSettings
  legacyOpeningDrawn?: boolean
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
  sevens: {
    initiator: number
    participants: number[]
    amount: number
    opening?: boolean
  } | null
  deadline: number | null
  result: RoundResult | null
  events?: GameEvent[]
  eventSequence?: number
  log: string[] // Derived compatibility view; events are the authoritative history.
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
// Rank 7 is never a face-up pickup, including in saves with stale eligible IDs.
export const pickupCards = (s: GameState): GameCard[] =>
  s.discards.flat().filter((c) => c.rank !== '7' && s.eligible.includes(c.id))
export const isPlaying = (s: GameState) =>
  ['turn', 'draw', 'penalty'].includes(s.phase)
export const canShow = (s: GameState, playerId: string) =>
  s.phase === 'turn' &&
  !s.legacyOpeningDrawn &&
  s.players[s.current].id === playerId &&
  !s.players[s.current].eliminated &&
  handTotal(s.players[s.current].hand, s.indicator.rank) <= 5

export function discardOutcome(
  phase: Phase,
  rank: GameRank,
  topRank: GameRank | undefined,
  hasPickup: boolean,
) {
  if (rank === '7') return 'seven' as const
  if (phase === 'penalty')
    throw new RuleError('Play one or more 7s, or accept the penalty.')
  if (rank === topRank) return 'match' as const
  return hasPickup ? ('choice' as const) : ('automatic' as const)
}

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
      'Your hand is empty. You must declare Least on your normal turn.',
    )
  if (!cardIds.length || new Set(cardIds).size !== cardIds.length) {
    throw new RuleError('Select one or more different cards from your hand.')
  }
  const cards = cardIds.map((id) => player.hand.find((c) => c.id === id))
  if (cards.some((c) => !c))
    throw new RuleError('You can only drop cards in your own hand.')
  const group = cards as GameCard[]
  const rank = group[0].rank
  if (!group.every((c) => c.rank === rank))
    throw new RuleError('All selected cards must have the same rank.')
  if (s.phase === 'penalty' && rank !== '7')
    throw new RuleError('Play one or more 7s, or accept the penalty.')
  const matchesTop = latestGroup(s).at(-1)?.rank === rank
  const outcome =
    s.legacyOpeningDrawn && rank !== '7'
      ? 'satisfied'
      : discardOutcome(
          s.phase,
          rank,
          latestGroup(s).at(-1)?.rank,
          pickupCards(s).length > 0,
        )
  return {
    cards: group,
    rank,
    matchesTop,
    outcome,
    needsDraw: outcome === 'choice' || outcome === 'automatic',
    needsChoice: outcome === 'choice',
  }
}

const publicPlayer = (p: Player): EventPlayer => ({ id: p.id, name: p.name })
function emit(s: GameState, data: GameEventData, now: number) {
  const history = gameEvents(s)
  const sequenceNumber =
    (s.eventSequence ?? history.at(-1)?.sequenceNumber ?? 0) + 1
  const event = {
    ...data,
    id: `event-${sequenceNumber}`,
    sequenceNumber,
    roundNumber: s.round,
    timestamp: now,
  } as GameEvent
  s.eventSequence = sequenceNumber
  s.events = [...history.slice(-(HISTORY_LIMIT - 1)), event]
  s.log = [...s.log.slice(-39), formatGameEvent(event)]
}
function nextActive(s: GameState, after: number): number {
  for (let step = 1; step <= s.players.length; step++) {
    const index = (after + step) % s.players.length
    if (!s.players[index].eliminated) return index
  }
  throw new RuleError('No active player remains.')
}

function lastPlayerWins(s: GameState, now: number): boolean {
  const survivors = active(s)
  if (survivors.length !== 1) return false
  s.phase = 'game-over'
  s.deadline = null
  s.sevens = null
  s.result = { reason: 'last-player', winners: [survivors[0].id], scores: [] }
  emit(s, { type: 'GAME_COMPLETED', winner: publicPlayer(survivors[0]) }, now)
  return true
}

function settle(
  s: GameState,
  reason: 'show' | 'exhaustion',
  callerId?: string,
  now = Date.now(),
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
    if (player.score >= gameSettings(s).eliminationThreshold) {
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
  if (reason === 'show')
    emit(
      s,
      {
        type: 'SHOW_RESOLVED',
        player: publicPlayer(players[callerIndex]),
        successful,
      },
      now,
    )
  emit(
    s,
    {
      type: 'ROUND_COMPLETED',
      reason,
      scores: scores.map(({ id, name, total, penalty, score }) => ({
        id,
        name,
        total,
        penalty,
        score,
      })),
    },
    now,
  )
  for (const score of scores)
    if (score.eliminated)
      emit(
        s,
        {
          type: 'PLAYER_ELIMINATED',
          player: { id: score.id, name: score.name },
          reason: 'score',
          cutoff: gameSettings(s).eliminationThreshold,
        },
        now,
      )
  if (s.phase === 'game-over')
    emit(s, { type: 'GAME_COMPLETED', winner: publicPlayer(active(s)[0]) }, now)
}

/** Draw only from the closed pile; protect the current group and pending open pickup. */
function drawCards(
  s: GameState,
  player: Player,
  count: number,
  now: number,
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
      if (s.drawPile.length) emit(s, { type: 'PILE_RECYCLED' }, now)
    }
    const card = s.drawPile.pop()
    if (!card) {
      settle(s, 'exhaustion', undefined, now)
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
  delete s.legacyOpeningDrawn
  if (lastPlayerWins(s, now)) return
  s.phase = s.sevens ? 'penalty' : 'turn'
  s.deadline = gameSettings(s).timedGame ? now + TURN_MS : null
  const player = s.players[index]
  if (s.sevens && !player.hand.some((c) => c.rank === '7')) {
    acceptPenalty(s, now, random)
  }
}

function acceptPenalty(s: GameState, now: number, random: () => number) {
  const player = s.players[s.current]
  const amount = s.sevens!.amount
  if (!drawCards(s, player, amount, now, random)) return
  emit(
    s,
    {
      type: 'POWER_SEVEN_PENALTY_DRAWN',
      player: publicPlayer(player),
      count: amount,
    },
    now,
  )
  s.eligible = []
  s.sevens = null
  beginTurn(s, nextActive(s, s.current), now, random)
}

function finishNormalTurn(s: GameState, now: number, random: () => number) {
  s.eligible = latestGroup(s)
    .filter((c) => c.rank !== '7')
    .map((c) => c.id)
  if (s.discardedRank === '7') {
    s.sevens = { initiator: s.current, participants: [s.current], amount: 2 }
    emit(
      s,
      {
        type: 'POWER_SEVEN_PLAYED',
        player: publicPlayer(s.players[s.current]),
        cards: latestGroup(s),
        penalty: 2,
        next: publicPlayer(s.players[nextActive(s, s.current)]),
        stacked: false,
      },
      now,
    )
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
  const openingCard = latestGroup(s)[0]
  const isSeven = openingCard.rank === '7'
  s.eligible = isSeven ? [] : [openingCard.id]
  // The computer's card is not a player response. The first responder is the initiator.
  s.sevens = isSeven
    ? { initiator: s.starter, participants: [], amount: 2, opening: true }
    : null
  s.result = null
  emit(
    s,
    { type: 'ROUND_STARTED', indicatorRank: indicator.rank, openingCard },
    now,
  )
  if (isSeven)
    emit(
      s,
      {
        type: 'OPENING_SEVEN_ACTIVATED',
        player: publicPlayer(s.players[s.starter]),
      },
      now,
    )
  beginTurn(s, s.starter, now, random)
}

export function createGame(
  names: string[],
  now = Date.now(),
  random = Math.random,
  settings: GameSettings = {
    eliminationThreshold: ELIMINATION_SCORE,
    timedGame: true,
  },
  playerIds?: string[],
): GameState {
  if (
    playerIds &&
    (playerIds.length !== names.length ||
      new Set(playerIds).size !== names.length)
  )
    throw new RuleError('Provide a unique ID for every player.')
  if (
    !Number.isSafeInteger(settings.eliminationThreshold) ||
    settings.eliminationThreshold <= 0 ||
    typeof settings.timedGame !== 'boolean'
  )
    throw new RuleError(
      'Choose a positive whole-number cutoff and timed or untimed play.',
    )
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
    settings: { ...settings },
    version: 1,
    players: names.map((name, index) => ({
      id: playerIds?.[index] ?? `p${index}`,
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
    events: [],
    eventSequence: 0,
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
  const s = normalizeLegacyTurn(structuredClone(state))
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
    emit(
      s,
      {
        type: 'PLAYER_ELIMINATED',
        player: publicPlayer(player),
        reason: 'timeout',
        cutoff: gameSettings(s).eliminationThreshold,
      },
      now,
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
      throw new RuleError('A combined turn must start before dropping.')
    const outcome = inspectDiscard(s, action.playerId, action.cardIds).outcome
    if (outcome === 'automatic' && action.source !== 'pile')
      throw new RuleError('Only the draw pile is available.')
    if (outcome === 'seven' || outcome === 'match' || outcome === 'satisfied') {
      throw new RuleError(
        'Playing 7s or Match and Drop requires no replacement draw.',
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
    if (outcome === 'automatic') return discarded
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
        'Least requires a total of 5 or less at the start of a normal turn.',
      )
    emit(
      s,
      {
        type: 'SHOW_DECLARED',
        player: publicPlayer(player),
        total: handTotal(player.hand, s.indicator.rank),
      },
      now,
    )
    settle(s, 'show', player.id, now)
  } else if (action.type === 'accept-penalty') {
    if (s.phase !== 'penalty' || !s.sevens)
      throw new RuleError('There is no pending 7 penalty.')
    acceptPenalty(s, now, random)
  } else if (action.type === 'discard') {
    const {
      cards: group,
      rank,
      outcome,
    } = inspectDiscard(s, action.playerId, action.cardIds)
    player.hand = player.hand.filter((c) => !action.cardIds.includes(c.id))
    s.discards.push(group)
    if (s.phase === 'penalty') {
      s.eligible = []
      s.sevens!.participants.push(s.current)
      s.sevens!.amount += 2
      const cycleComplete = s.sevens!.participants.length === active(s).length
      if (!cycleComplete)
        emit(
          s,
          {
            type: 'POWER_SEVEN_PLAYED',
            player: publicPlayer(player),
            cards: group,
            penalty: s.sevens!.amount,
            next: publicPlayer(s.players[nextActive(s, s.current)]),
            stacked: true,
          },
          now,
        )
      if (s.sevens!.participants.length === active(s).length) {
        const initiator = s.sevens!.initiator
        const opening = s.sevens!.opening === true
        s.sevens = null
        emit(
          s,
          {
            type: 'POWER_SEVEN_PLAYED',
            player: publicPlayer(player),
            cards: group,
            penalty: 0,
            next: publicPlayer(s.players[initiator]),
            stacked: true,
          },
          now,
        )
        emit(
          s,
          {
            type: 'POWER_SEVEN_CYCLE_COMPLETED',
            opening,
            next: publicPlayer(s.players[initiator]),
          },
          now,
        )
        beginTurn(s, initiator, now, random)
      } else beginTurn(s, nextActive(s, s.current), now, random)
    } else {
      s.discardedRank = rank
      if (outcome === 'seven') finishNormalTurn(s, now, random)
      else if (outcome === 'satisfied' || outcome === 'match') {
        emit(
          s,
          {
            type: 'TURN_COMPLETED',
            player: publicPlayer(player),
            cards: group,
            draw: 'none',
            opening: outcome === 'satisfied',
          },
          now,
        )
        finishNormalTurn(s, now, random)
      } else if (outcome === 'automatic') {
        if (drawCards(s, player, 1, now, random)) {
          emit(
            s,
            {
              type: 'TURN_COMPLETED',
              player: publicPlayer(player),
              cards: group,
              draw: 'automatic',
            },
            now,
          )
          finishNormalTurn(s, now, random)
        }
      } else s.phase = 'draw' // The deadline is deliberately unchanged.
    }
  } else if (action.type === 'draw') {
    if (s.phase !== 'draw')
      throw new RuleError(
        'Drop first. Match and Drop does not allow a replacement draw.',
      )
    const discardedCards = latestGroup(s)
    // Resolve older saves that were waiting for a now-unnecessary 7 draw.
    if (s.discardedRank === '7') {
      if (action.source === 'discard')
        throw new RuleError('Playing 7s requires no replacement pickup.')
      finishNormalTurn(s, now, random)
      return s
    }
    if (action.source === 'discard') {
      const card = pickupCards(s).find((c) => c.id === action.cardId)
      if (!card)
        throw new RuleError(
          'Choose one card from the preceding eligible group, not your own drop.',
        )
      player.hand.push(card)
      s.discards = s.discards
        .map((group) => group.filter((c) => c.id !== card.id))
        .filter((group) => group.length)
      emit(
        s,
        {
          type: 'TURN_COMPLETED',
          player: publicPlayer(player),
          cards: discardedCards,
          draw: 'pickup',
          pickup: card,
        },
        now,
      )
    } else {
      if (!drawCards(s, player, 1, now, random)) return s
      emit(
        s,
        {
          type: 'TURN_COMPLETED',
          player: publicPlayer(player),
          cards: discardedCards,
          draw: pickupCards(s).length ? 'pile' : 'automatic',
        },
        now,
      )
    }
    finishNormalTurn(s, now, random)
  } else throw new RuleError('That action is not available.')
  return s
}

/** Upgrade a pending legacy draw without adding a client action or resetting its deadline. */
export function resolveForcedDraw(
  state: GameState,
  now = Date.now(),
  random = Math.random,
): GameState {
  state = normalizeLegacyTurn(state)
  if (
    state.phase !== 'draw' ||
    (state.discardedRank !== '7' && pickupCards(state).length)
  )
    return state
  return applyAction(
    state,
    { type: 'draw', playerId: state.players[state.current].id, source: 'pile' },
    now,
    random,
  )
}

/** One-time compatibility for saves from the retired draw-first release. New rounds never use these phases. */
export function normalizeLegacyTurn(state: GameState): GameState {
  const oldPhase = state.phase as string
  if (oldPhase !== 'opening-draw' && oldPhase !== 'opening-discard')
    return state
  const next = structuredClone(state)
  next.phase = 'turn'
  if (oldPhase === 'opening-discard') next.legacyOpeningDrawn = true
  return next
}
