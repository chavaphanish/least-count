import { describe, expect, it } from 'vitest'
import { layoutHand, MAX_HAND_BOUND } from './handLayout'
describe('single-row hand geometry', () => {
  for (const [width, height] of [
    [450, 122],
    [630, 120],
    [780, 138],
    [900, 150],
  ])
    it(`keeps every card in one bounded row at ${width}×${height}`, () => {
      for (let count = 1; count <= MAX_HAND_BOUND; count++) {
        const layout = layoutHand(count, width, height)
        expect(layout.rows).toBe(1)
        expect(layout.items).toHaveLength(count)
        expect(layout.cardHeight / layout.cardWidth).toBeCloseTo(1.4)
        for (const [index, item] of layout.items.entries()) {
          expect(item.x).toBeGreaterThanOrEqual(-0.001)
          expect(item.y - layout.lift).toBeGreaterThanOrEqual(-0.001)
          expect(item.x + layout.cardWidth).toBeLessThanOrEqual(width + 0.001)
          expect(item.y + layout.cardHeight).toBeLessThanOrEqual(height + 0.001)
          expect(item.y).toBeCloseTo(layout.items[0].y)
          expect(item.hitWidth).toBeGreaterThan(0)
          if (index < count - 1)
            expect(item.x + item.hitWidth).toBeCloseTo(
              layout.items[index + 1].x,
            )
          if (width >= 630 && count <= 30)
            expect(item.hitWidth).toBeGreaterThanOrEqual(18)
        }
      }
    })
  it('reports extreme touch density instead of claiming ordinary targets', () => {
    const dense = layoutHand(MAX_HAND_BOUND, 630, 120)
    expect(dense.compact).toBe(true)
    expect(dense.stepX).toBeLessThan(6)
    expect(layoutHand(30, 630, 120).compact).toBe(false)
    expect(layoutHand(0, 100, 100).items).toEqual([])
  })
  it('keeps initial unmeasured geometry finite', () => {
    for (const count of [1, 30, 104]) {
      const layout = layoutHand(count, 1, 1)
      expect(layout.cardWidth).toBeGreaterThan(0)
      expect(layout.items.at(-1)!.x + layout.cardWidth).toBeLessThanOrEqual(
        1.001,
      )
    }
  })
})
