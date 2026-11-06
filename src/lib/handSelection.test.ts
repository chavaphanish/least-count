import { describe, expect, it } from 'vitest'
import { createCard } from '../game/cards'
import { dropLabel, toggleHandCard } from './handSelection'

const queen = createCard('hearts', 'Q')
const otherQueen = createCard('clubs', 'Q')
const king = createCard('spades', 'K')
const hand = [queen, otherQueen, king]
describe('hand selection', () => {
  it('toggles matching cards and replaces the group when the rank changes', () => {
    let selected = toggleHandCard(hand, [], queen)
    selected = toggleHandCard(hand, selected, otherQueen)
    expect(selected).toEqual([queen.id, otherQueen.id])
    expect(dropLabel(hand.filter(card => selected.includes(card.id)))).toBe('Drop 2 Queens')
    selected = toggleHandCard(hand, selected, king)
    expect(selected).toEqual([king.id])
    expect(toggleHandCard(hand, selected, king)).toEqual([])
  })
  it('names single cards, groups, and power actions consistently', () => {
    expect(dropLabel([])).toBe('Drop Selected Cards')
    expect(dropLabel([queen])).toBe('Drop 1 Card')
    expect(dropLabel([createCard('clubs', '7')])).toBe('Play 7')
    expect(dropLabel([createCard('clubs', '7'), createCard('hearts', '7')])).toBe('Play 2 Sevens')
  })
})
