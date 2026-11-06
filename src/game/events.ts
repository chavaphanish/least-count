import type { GameCard, GameRank } from './deck'

export type EventPlayer = { id: string; name: string }
export type GameEventData =
  | { type: 'ROUND_STARTED'; indicatorRank: GameRank; openingCard?: GameCard }
  | { type: 'OPENING_SEVEN_ACTIVATED'; player: EventPlayer }
  | ({ type: 'OPENING_CARD_SELECTED'; player: EventPlayer } & (
      { source: 'pile' } | { source: 'discard'; card: GameCard }
    ))
  | {
      type: 'TURN_COMPLETED'
      player: EventPlayer
      cards: GameCard[]
      draw: 'pile' | 'automatic' | 'pickup' | 'none'
      pickup?: GameCard
      opening?: boolean
    }
  | {
      type: 'POWER_SEVEN_PLAYED'
      player: EventPlayer
      cards: GameCard[]
      penalty: number
      next: EventPlayer
      stacked: boolean
    }
  | { type: 'POWER_SEVEN_PENALTY_DRAWN'; player: EventPlayer; count: number }
  | {
      type: 'POWER_SEVEN_CYCLE_COMPLETED'
      next: EventPlayer
      opening?: boolean
    }
  | { type: 'SHOW_DECLARED'; player: EventPlayer; total: number }
  | { type: 'SHOW_RESOLVED'; player: EventPlayer; successful: boolean }
  | {
      type: 'ROUND_COMPLETED'
      reason: 'show' | 'exhaustion'
      scores: {
        id: string
        name: string
        total: number
        penalty: number
        score: number
      }[]
    }
  | {
      type: 'PLAYER_ELIMINATED'
      player: EventPlayer
      reason: 'score' | 'timeout'
      cutoff: number
    }
  | { type: 'GAME_COMPLETED'; winner: EventPlayer }
  | { type: 'PILE_RECYCLED' }
  | { type: 'LEGACY_ACTIVITY'; message: string }
export type GameEvent = GameEventData & {
  id: string
  sequenceNumber: number
  roundNumber: number
  timestamp: number
}
/** Old releases retained only public text. Preserve it with explicit unknown-round metadata. */
export function gameEvents(state: {
  events?: GameEvent[]
  log: string[]
}): GameEvent[] {
  return (
    state.events ??
    state.log.map((message, index) => ({
      type: 'LEGACY_ACTIVITY',
      message,
      id: `event-${index + 1}`,
      sequenceNumber: index + 1,
      roundNumber: 0,
      timestamp: 0,
    }))
  )
}
export const HISTORY_LIMIT = 2000
const ranks: Partial<Record<GameRank, string>> = {
  A: 'Ace',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  PJ: 'Printed Joker',
}
export function formatCardName(card: GameCard): string {
  return card.rank === 'PJ'
    ? 'Printed Joker'
    : `${ranks[card.rank] ?? card.rank} of ${card.suit[0].toUpperCase()}${card.suit.slice(1)}`
}
export function formatCardGroup(cards: readonly GameCard[]): string {
  if (cards.length === 1) return `the ${formatCardName(cards[0])}`
  const count =
    ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][
      cards.length
    ] ?? String(cards.length)
  return `${count} ${ranks[cards[0]?.rank] ?? cards[0]?.rank}s`
}
export function formatGameEvent(event: GameEvent): string {
  switch (event.type) {
    case 'ROUND_STARTED':
      if (event.openingCard)
        return `Round ${event.roundNumber} started. The opening card is the ${formatCardName(event.openingCard)}. Round Joker rank ${event.indicatorRank}.`
      return `Round ${event.roundNumber} started: seven cards each; Round Joker rank ${event.indicatorRank}.`
    case 'OPENING_SEVEN_ACTIVATED':
      return `The opening 7 activated a two-card penalty for ${event.player.name}.`
    case 'OPENING_CARD_SELECTED':
      return event.source === 'discard'
        ? `${event.player.name} picked up the opening ${formatCardName(event.card)}.`
        : `${event.player.name} drew a card from the draw pile instead of picking up the opening card.`
    case 'TURN_COMPLETED': {
      const action = `${event.player.name} discarded ${formatCardGroup(event.cards)}`
      if (event.opening)
        return `${action} and completed the opening turn. No additional replacement card was drawn.`
      if (event.draw === 'none')
        return `${action} using Match and Drop. No replacement card was required.`
      if (event.draw === 'pickup' && event.pickup)
        return `${action} and picked up the ${formatCardName(event.pickup)} from the previous player's discard.`
      return `${action} and ${event.draw === 'automatic' ? 'automatically ' : ''}drew a card from the draw pile.`
    }
    case 'POWER_SEVEN_PLAYED':
      if (event.penalty === 0)
        return `${event.player.name} played ${formatCardGroup(event.cards)}. No replacement card was drawn.`
      return `${event.player.name} played ${formatCardGroup(event.cards)}. ${event.stacked ? `The accumulated penalty increased to ${event.penalty} cards. ` : ''}${event.next.name} must draw ${event.penalty} cards or play a 7. No replacement card was drawn.`
    case 'POWER_SEVEN_PENALTY_DRAWN':
      return `${event.player.name} drew ${event.count} penalty cards and skipped their turn.`
    case 'POWER_SEVEN_CYCLE_COMPLETED':
      return `${event.opening ? 'Full cycle of opening 7s' : 'Full cycle of 7s'}: penalty cancelled. ${event.next.name} plays next.`
    case 'SHOW_DECLARED':
      return `${event.player.name} declared Show with a hand total of ${event.total}.`
    case 'SHOW_RESOLVED':
      return `${event.player.name}'s Show ${event.successful ? 'succeeded (zero-point ties allowed).' : 'failed. A 40-point penalty was applied.'}`
    case 'ROUND_COMPLETED':
      return `Round ${event.roundNumber} completed${event.reason === 'exhaustion' ? ' by draw-pile exhaustion' : ''}. Scores: ${event.scores.map((p) => `${p.name} +${p.penalty} (${p.score} total)`).join('; ')}.`
    case 'PLAYER_ELIMINATED':
      return event.reason === 'timeout'
        ? `${event.player.name} failed to complete the turn within 60 seconds and was eliminated.`
        : `${event.player.name} reached the elimination threshold of ${event.cutoff} points and was eliminated.`
    case 'GAME_COMPLETED':
      return `${event.winner.name} wins the match.`
    case 'LEGACY_ACTIVITY':
      return event.message.replace(/selected joker/gi, 'Round Joker')
    case 'PILE_RECYCLED':
      return 'Older discards were reshuffled into the draw pile.'
  }
}
