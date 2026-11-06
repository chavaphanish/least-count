import { expect, it } from 'vitest'
import { xpProgress, xpRequiredForLevel } from './model'
it('derives level and within-level progress at and between thresholds', () => {
  expect([1, 2, 3, 4, 5, 6, 7].map((n) => xpRequiredForLevel(n))).toEqual([
    0, 100, 300, 600, 1000, 1500, 2100,
  ])
  expect(xpProgress(1250)).toMatchObject({
    level: 5,
    earned: 250,
    needed: 500,
    next: 1500,
  })
  expect(xpProgress(100)).toMatchObject({ level: 2, earned: 0 })
  expect(xpProgress(0)).toMatchObject({ level: 1, earned: 0 })
})
