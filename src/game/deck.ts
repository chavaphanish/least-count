import { createDeck, shuffleDeck } from './cards'
import type { Card, Rank } from './cards'

export type PrintedJoker = Readonly<{ id: string; rank: 'PJ'; suit: 'joker' }>
export type GameCard = Card | PrintedJoker
export type GameRank = GameCard['rank']

export function assembleDeck(playerCount: number): GameCard[] {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 8) {
    throw new RangeError('Choose between 2 and 8 players.')
  }
  return Array.from({ length: playerCount <= 4 ? 1 : 2 }, (_, index) => {
    const cards: GameCard[] = createDeck().map((card) => ({
      ...card,
      id: `deck${index}:${card.id}`,
    }))
    cards.push({ id: `deck${index}:joker`, rank: 'PJ', suit: 'joker' })
    return cards
  }).flat()
}

export function cardValue(card: GameCard, selectedRank: Rank): number {
  if (card.rank === '7') return 7
  if (card.rank === 'PJ' || card.rank === selectedRank) return 0
  if (card.rank === 'A') return 1
  if (['J', 'Q', 'K'].includes(card.rank)) return 10
  return Number(card.rank)
}

export function handTotal(
  hand: readonly GameCard[],
  selectedRank: Rank,
): number {
  return hand.reduce((sum, card) => sum + cardValue(card, selectedRank), 0)
}

export function prepareDeck(
  playerCount: number,
  random: () => number,
): { indicator: Card; cards: GameCard[] } {
  const shuffled = shuffleDeck(assembleDeck(playerCount), random)
  // The first eligible card in a uniform shuffle gives an eligible random indicator.
  const index = shuffled.findIndex(
    (card) => card.rank !== '7' && card.rank !== 'PJ',
  )
  const indicator = shuffled.splice(index, 1)[0] as Card
  return { indicator, cards: shuffleDeck(shuffled, random) }
}

export function cardLabel(card: GameCard): string {
  return card.rank === 'PJ' ? 'Printed Joker' : `${card.rank} of ${card.suit}`
}
