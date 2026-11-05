import { RANKS, SUITS } from '../game/cards'
import type { GameCard } from '../game/deck'
import { gameSettings, isPlaying } from '../game/engine'
import type { GameState } from '../game/engine'

export const SESSION_KEY = 'least-count:local-game:v1'
export type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function validCard(card: GameCard): boolean {
  return (
    !!card &&
    typeof card.id === 'string' &&
    !!card.id &&
    (card.rank === 'PJ'
      ? card.suit === 'joker'
      : RANKS.includes(card.rank) && SUITS.includes(card.suit))
  )
}

/** Reject corrupt or outdated local saves; this is not an online trust boundary. */
export function isSavedGame(value: unknown): value is GameState {
  try {
    const s = value as GameState
    if (
      !s ||
      s.version !== 1 ||
      !Array.isArray(s.players) ||
      s.players.length < 2 ||
      s.players.length > 8
    )
      return false
    if (
      !['turn', 'draw', 'penalty', 'round-over', 'game-over'].includes(s.phase)
    )
      return false
    const index = (n: number) =>
      Number.isInteger(n) && n >= 0 && n < s.players.length
    if (
      !index(s.current) ||
      !index(s.starter) ||
      !Number.isInteger(s.round) ||
      s.round < 1
    )
      return false
    if (new Set(s.players.map((p) => p.id)).size !== s.players.length)
      return false
    if (
      !s.players.every(
        (p) =>
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          p.name.trim() &&
          Number.isInteger(p.score) &&
          p.score >= 0 &&
          typeof p.eliminated === 'boolean' &&
          Array.isArray(p.hand) &&
          p.hand.every(validCard) &&
          (!p.eliminated || p.hand.length === 0),
      )
    )
      return false
    if (
      !Array.isArray(s.drawPile) ||
      !s.drawPile.every(validCard) ||
      !Array.isArray(s.discards) ||
      !s.discards.length ||
      !s.discards.every(
        (g) => Array.isArray(g) && g.length && g.every(validCard),
      )
    )
      return false
    if (
      !validCard(s.indicator) ||
      s.indicator.rank === '7' ||
      !SUITS.includes(s.indicator.suit)
    )
      return false
    const all = [
      ...s.players.flatMap((p) => p.hand),
      ...s.drawPile,
      ...s.discards.flat(),
      s.indicator,
    ]
    if (all.length > 106 || new Set(all.map((c) => c.id)).size !== all.length)
      return false
    if (
      !Array.isArray(s.eligible) ||
      !s.eligible.every((id) => s.discards.flat().some((c) => c.id === id))
    )
      return false
    if (s.discardedRank !== null && ![...RANKS, 'PJ'].includes(s.discardedRank))
      return false
    if (
      !Array.isArray(s.log) ||
      s.log.length > 40 ||
      !s.log.every((line) => typeof line === 'string')
    )
      return false
    const activeCount = s.players.filter((p) => !p.eliminated).length
    const settings = gameSettings(s)
    if (!Number.isSafeInteger(settings.eliminationThreshold) || settings.eliminationThreshold <= 0 || typeof settings.timedGame !== 'boolean') return false
    if (isPlaying(s)) {
      if (
        (settings.timedGame ? typeof s.deadline !== 'number' || !Number.isFinite(s.deadline) : s.deadline !== null) ||
        s.players[s.current].eliminated ||
        activeCount < 2 ||
        s.result !== null
      )
        return false
    } else if (
      s.deadline !== null ||
      !s.result ||
      !['show', 'exhaustion', 'last-player'].includes(s.result.reason) ||
      !Array.isArray(s.result.winners) ||
      !s.result.winners.every((id) => s.players.some((p) => p.id === id)) ||
      !Array.isArray(s.result.scores) ||
      !s.result.scores.every(
        (p) =>
          typeof p.name === 'string' &&
          s.players.some((player) => player.id === p.id) &&
          [p.total, p.penalty, p.score].every(
            (n) => Number.isFinite(n) && n >= 0,
          ),
      )
    )
      return false
    if (s.phase === 'game-over' && activeCount !== 1) return false
    if (s.phase === 'round-over' && activeCount < 2) return false
    if (s.phase === 'penalty') {
      if (
        !s.sevens ||
        !index(s.sevens.initiator) ||
        !Number.isInteger(s.sevens.amount) ||
        s.sevens.amount < 2 ||
        s.sevens.amount % 2 ||
        !Array.isArray(s.sevens.participants) ||
        !s.sevens.participants.length ||
        !s.sevens.participants.every(index) ||
        new Set(s.sevens.participants).size !== s.sevens.participants.length
      )
        return false
    } else if (s.sevens !== null) return false
    return true
  } catch {
    return false
  }
}

export function loadSession(store: SessionStore): GameState | null {
  const raw = store.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const saved: unknown = JSON.parse(raw)
    if (isSavedGame(saved)) return saved
  } catch {
    /* Invalid JSON is discarded below. */
  }
  store.removeItem(SESSION_KEY)
  return null
}

export function saveSession(store: SessionStore, game: GameState | null) {
  if (game) store.setItem(SESSION_KEY, JSON.stringify(game))
  else store.removeItem(SESSION_KEY)
}
