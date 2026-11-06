import type { GameCard, GameRank } from '../game/deck'

/** Toggle matching ranks; a new rank starts a fresh selection. */
export function toggleHandCard(hand: readonly GameCard[], selected: readonly string[], card: GameCard): string[] {
  if (selected.includes(card.id)) return selected.filter(id => id !== card.id)
  const sameRank = hand.filter(c => selected.includes(c.id)).every(c => c.rank === card.rank)
  return sameRank ? [...selected, card.id] : [card.id]
}

export function dropLabel(cards: readonly GameCard[]): string {
  if (!cards.length) return 'Drop Selected Cards'
  if (cards[0].rank === '7') return cards.length === 1 ? 'Play 7' : `Play ${cards.length} Sevens`
  if (cards.length === 1) return 'Drop 1 Card'
  const plurals: Partial<Record<GameRank, string>> = { A: 'Aces', J: 'Jacks', Q: 'Queens', K: 'Kings', PJ: 'Printed Jokers' }
  const rank = plurals[cards[0].rank]
  return `Drop ${cards.length} ${rank ?? `${cards[0].rank}s`}`
}

/** Short feedback supplements the public log without exposing closed cards. */
export function latestActionHint(events: readonly import('../game/events').GameEvent[]): string | undefined {
  const event = events.at(-1)
  if (event?.type === 'TURN_COMPLETED' && event.draw === 'none') return 'Match and Drop! No card required.'
  if (event?.type === 'POWER_SEVEN_PLAYED') return 'Power Card 7 activated!'
  return undefined
}
