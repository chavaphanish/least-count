import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createGame, latestGroup } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import { cardLabel } from '../src/game/deck'
import { SESSION_KEY } from '../src/lib/session'
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
function fixture(seven = false, noSeven = false) {
  for (let seed = 1; seed < 5000; seed++) {
    const s = createGame(['You', 'Alex', 'Ben'], Date.now(), seeded(seed))
    if (s.starter !== 0 || (latestGroup(s)[0].rank === '7') !== seven) continue
    if (seven) {
      if (noSeven ? s.players[0].hand.length !== 9 : s.phase !== 'penalty')
        continue
    }
    return s
  }
  throw new Error('No matching opening')
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)!),
    SESSION_KEY,
  )
}
async function load(page: Page, s: GameState) {
  await page.clock.install({ time: new Date(s.deadline! - 60_000) })
  await page.clock.pauseAt(new Date(s.deadline! - 59_999))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, s }) => sessionStorage.setItem(key, JSON.stringify(s)),
    { key: SESSION_KEY, s },
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Your hand', exact: true }),
  ).toBeVisible()
}
test('requires a discard before opening pickup and restores the pending replacement after refresh', async ({
  page,
}) => {
  const s = fixture()
  const opener = latestGroup(s)[0]
  await load(page, s)
  await expect(
    page.getByRole('button', { name: 'Draw New Card', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Pick up/ })).toHaveCount(0)
  await expect(page.locator('[data-draw-source]')).toBeDisabled()
  expect((await saved(page)).players[0].hand).toHaveLength(7)
  const index = s.players[0].hand.findIndex(
    (c) => c.rank !== '7' && c.rank !== opener.rank,
  )
  await page
    .getByRole('group', { name: 'Your hand', exact: true })
    .getByRole('button')
    .nth(index)
    .click()
  await page
    .getByRole('button', { name: 'Drop 1 Card', exact: true })
    .click()
  const waiting = await saved(page)
  expect(waiting.phase).toBe('draw')
  expect(waiting.players[0].hand).toHaveLength(6)
  expect(waiting.drawPile).toEqual(s.drawPile)
  expect(waiting.eligible).toEqual([opener.id])
  expect(latestGroup(waiting)[0].id).toBe(s.players[0].hand[index].id)
  expect(waiting.deadline).toBe(s.deadline)
  await page.reload()
  expect((await saved(page)).phase).toBe('draw')
  await page
    .getByRole('button', { name: `Pick up ${cardLabel(opener)}`, exact: true })
    .click()
  const done = await saved(page)
  expect(done.players[0].hand).toHaveLength(7)
  expect(done.players[0].hand).toContainEqual(opener)
  expect(done.current).toBe(1)
  expect(done.discards.flat().some((c) => c.id === opener.id)).toBe(false)
  expect(done.drawPile).toEqual(s.drawPile)
})
test('closed replacement is offered only after the first discard and keeps its identity private in the log', async ({
  page,
}) => {
  const s = fixture()
  const opener = latestGroup(s)[0]
  const hidden = s.drawPile.at(-1)!
  await load(page, s)
  const index = s.players[0].hand.findIndex(
    (c) => c.rank !== '7' && c.rank !== opener.rank,
  )
  await page
    .getByRole('group', { name: 'Your hand', exact: true })
    .getByRole('button')
    .nth(index)
    .click()
  await page
    .getByRole('button', { name: 'Drop 1 Card', exact: true })
    .click()
  expect((await saved(page)).players[0].hand).toHaveLength(6)
  await page
    .getByRole('button', { name: 'Draw New Card', exact: true })
    .click()
  const done = await saved(page)
  expect(done.players[0].hand).toHaveLength(7)
  expect(done.discards.flat()).toContainEqual(opener)
  expect(done.drawPile).toHaveLength(s.drawPile.length - 1)
  expect(done.events!.at(-1)).toMatchObject({
    type: 'TURN_COMPLETED',
    draw: 'pile',
  })
  expect(JSON.stringify(done.events!.at(-1))).not.toContain(hidden.id)
})
test('opening 7 offers penalty acceptance or selected 7s, never ordinary pickup or Show', async ({
  page,
}) => {
  const s = fixture(true)
  await load(page, s)
  await expect(
    page.getByRole('button', { name: 'Draw 2 Penalty Cards', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Play 7', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Declare Least', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Pick up opening/ }),
  ).toHaveCount(0)
  const sevens = s.players[0].hand.flatMap((c, i) =>
    c.rank === '7' ? [i] : [],
  )
  for (const index of sevens)
    await page
      .getByRole('group', { name: 'Your hand', exact: true })
      .getByRole('button')
      .nth(index)
      .click()
  await page
    .getByRole('button', { name: sevens.length === 1 ? 'Play 7' : `Play ${sevens.length} Sevens`, exact: true })
    .click()
  const done = await saved(page)
  expect(done.players[0].hand).toHaveLength(7 - sevens.length)
  expect(
    done.events!.some(
      (e) => e.type === 'POWER_SEVEN_PLAYED' && e.penalty === 4,
    ),
  ).toBe(true)
})
test('opening penalty acceptance draws two and skips discarding', async ({
  page,
}) => {
  const s = fixture(true)
  await load(page, s)
  await page.getByRole('button', { name: 'Draw 2 Penalty Cards', exact: true }).click()
  const done = await saved(page)
  expect(done.players[0].hand).toHaveLength(9)
  expect(done.current).toBe(1)
  expect(done.phase).toBe('turn')
  expect(done.sevens).toBeNull()
})
for (const width of [320, 1440])
  test(`discard-first opening fits at ${width}px and preserve their deadline`, async ({
    page,
  }) => {
    const s = fixture()
    await page.setViewportSize({ width, height: 1000 })
    await load(page, s)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/least-count-discard-first-${width}.png`,
      fullPage: true,
    })
    await page.clock.fastForward(60_000)
    expect((await saved(page)).players[0].eliminationReason).toBe('timeout')
  })
