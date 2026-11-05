import { describe, expect, it, vi } from 'vitest'
import { createCard, createDeck, RANKS, shuffleDeck, SUITS } from './cards'

describe('standard playing cards', () => {
  it('creates a card with a stable suit/rank identity', () => {
    expect(createCard('hearts', 'Q')).toEqual({ id: 'hearts-Q', suit: 'hearts', rank: 'Q' })
  })

  it('creates exactly 52 unique cards, with every rank in each suit', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(card => card.id)).size).toBe(52)
    for (const suit of SUITS) {
      expect(deck.filter(card => card.suit === suit).map(card => card.rank)).toEqual([...RANKS])
    }
  })

  it('creates independent deck and card instances', () => {
    const first = createDeck()
    const second = createDeck()
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])
  })
})

describe('shuffleDeck', () => {
  it('performs the expected Fisher–Yates swaps with a deterministic source', () => {
    const random = vi.fn(() => 0)
    expect(shuffleDeck(['A', 'B', 'C', 'D'], random)).toEqual(['B', 'C', 'D', 'A'])
    expect(random).toHaveBeenCalledTimes(3)
  })

  it('preserves all cards and does not mutate a frozen input', () => {
    const deck = Object.freeze(createDeck())
    const originalOrder = deck.map(card => card.id)
    const shuffled = shuffleDeck(deck, () => 0.42)
    expect(shuffled).not.toBe(deck)
    expect(shuffled.map(card => card.id).sort()).toEqual([...originalOrder].sort())
    expect(deck.map(card => card.id)).toEqual(originalOrder)
  })

  it('accepts a random value just below one', () => {
    expect(shuffleDeck([1, 2, 3], () => 0.999999)).toEqual([1, 2, 3])
  })

  it.each([{ input: [] }, { input: [1] }])('returns a fresh array for $input without requesting randomness', ({ input }) => {
    const random = vi.fn()
    const output = shuffleDeck(input, random)
    expect(output).toEqual(input)
    expect(output).not.toBe(input)
    expect(random).not.toHaveBeenCalled()
  })

  it.each([-0.1, 1, NaN, Infinity])('rejects invalid random value %s', value => {
    expect(() => shuffleDeck([1, 2], () => value)).toThrow(RangeError)
  })
})
