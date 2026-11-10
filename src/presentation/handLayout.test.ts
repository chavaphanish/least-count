import { describe, expect, it } from 'vitest'
import { layoutHand, MAX_HAND_BOUND } from './handLayout'

describe('adaptive hand geometry', () => {
  for (const [width, height] of [
    [450, 122],
    [630, 138],
    [780, 167],
    [900, 190],
  ])
    it(`keeps every identity and disjoint touch region inside ${width}×${height}`, () => {
      for (
        let count = 1;
        count <= (width < 600 ? 14 : MAX_HAND_BOUND);
        count++
      ) {
        const layout = layoutHand(count, width, height)
        expect(layout.items).toHaveLength(count)
        expect(layout.cardHeight / layout.cardWidth).toBeCloseTo(1.4)
        const overlaps: number[] = []
        for (const [i, item] of layout.items.entries()) {
          expect(item.x).toBeGreaterThanOrEqual(-0.001)
          expect(item.y - layout.lift).toBeGreaterThanOrEqual(-0.001)
          expect(item.x + layout.cardWidth).toBeLessThanOrEqual(width + 0.001)
          expect(item.y + layout.cardHeight).toBeLessThanOrEqual(height + 0.001)
          expect(item.hitWidth).toBeGreaterThanOrEqual(20)
          expect(item.hitHeight).toBeGreaterThanOrEqual(28)
          for (const other of layout.items.slice(i + 1)) {
            const overlapX =
              Math.min(item.x + item.hitWidth, other.x + other.hitWidth) -
              Math.max(item.x, other.x)
            const overlapY =
              Math.min(item.y + item.hitHeight, other.y + other.hitHeight) -
              Math.max(item.y, other.y)
            if (overlapX > 0.001 && overlapY > 0.001) overlaps.push(i)
          }
        }
        expect(overlaps).toEqual([])
      }
    })
  it('uses a single row for normal hands and compact rows when needed', () => {
    expect(layoutHand(7, 450, 122).rows).toBe(1)
    expect(layoutHand(MAX_HAND_BOUND, 630, 138).rows).toBeGreaterThan(1)
    expect(layoutHand(0, 100, 100).items).toEqual([])
  })
  it('keeps the initial unmeasured region finite and nonnegative', () => {
    const layout = layoutHand(7, 1, 1)
    expect(layout.cardWidth).toBeGreaterThan(0)
    expect(layout.cardHeight).toBeGreaterThan(0)
    for (const item of layout.items) {
      expect(item.y + layout.cardHeight).toBeLessThanOrEqual(1.001)
      expect(item.x + layout.cardWidth).toBeLessThanOrEqual(1.001)
    }
  })
})
