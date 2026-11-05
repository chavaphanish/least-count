// Standard playing-card primitives; game-specific decks and values live in deck.ts.
export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

export type Suit = typeof SUITS[number]
export type Rank = typeof RANKS[number]
export type Card = Readonly<{ id: string; suit: Suit; rank: Rank }>

export function createCard(suit: Suit, rank: Rank): Card {
  return { id: `${suit}-${rank}`, suit, rank }
}

/** A standard 52-card deck, without jokers; not a Least Count rules configuration. */
export function createDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => createCard(suit, rank)))
}

/** Fisher–Yates shuffle. Returns a new array and leaves the input untouched. */
export function shuffleDeck<T>(deck: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const value = random()
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Random source must return a number in [0, 1).')
    }
    const j = Math.floor(value * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
