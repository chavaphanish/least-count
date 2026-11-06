import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createGame } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import { createCard } from '../src/game/cards'
import { SESSION_KEY } from '../src/lib/session'
function fixture() {
  const s = createGame(['You', 'Alex', 'Ben'], Date.now(), () => 0.6)
  s.phase = 'turn'
  s.sevens = null
  s.current = 0
  s.starter = 0
  s.deadline = Date.now() + 60_000
  s.indicator = createCard('diamonds', '9')
  s.players[0].hand = [
    { ...createCard('hearts', 'K'), id: 'king' },
    { ...createCard('clubs', '7'), id: 'seven' },
    { id: 'joker', rank: 'PJ', suit: 'joker' },
  ]
  s.players[1].hand = [{ ...createCard('hearts', '7'), id: 'other-seven' }]
  s.discards = [[{ ...createCard('hearts', '3'), id: 'old' }]]
  s.eligible = []
  s.events = Array.from({ length: 20 }, (_, i) => ({
    type: 'PILE_RECYCLED',
    id: `event-${i + 1}`,
    sequenceNumber: i + 1,
    roundNumber: 1,
    timestamp: Date.now(),
  }))
  s.eventSequence = 20
  return s
}
async function load(page: Page, game: GameState) {
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 100))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
    { key: SESSION_KEY, game },
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Your hand', exact: true }),
  ).toBeVisible()
}
test('initiating 7 has no draw prompt and synchronizes a public power event', async ({
  page,
}) => {
  const s = fixture()
  const pile = s.drawPile.length
  await load(page, s)
  await page.getByRole('button', { name: /^7 of clubs/ }).click()
  await page
    .getByRole('button', { name: 'Play 7', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Draw New Card', exact: true }),
  ).toHaveCount(0)
  const saved = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)!),
    SESSION_KEY,
  )
  expect(saved.players[0].hand).toHaveLength(2)
  expect(saved.drawPile).toHaveLength(pile)
  expect(saved.phase).toBe('penalty')
  await expect(
    page.locator('.game-activity .latest-event:visible'),
  ).toContainText('You played the 7 of Clubs')
})
test('forced replacement draws with one click and keeps expanded history scroll stable', async ({
  page,
}) => {
  const s = fixture()
  await load(page, s)
  await page.getByRole('button', { name: 'View Full History' }).click()
  const history = page.getByRole('list', { name: 'Full game history' })
  await history.evaluate((el) => (el.scrollTop = 40))
  const before = await history.evaluate((el) => el.scrollTop)
  await page.getByRole('button', { name: /^K of hearts/ }).click()
  await page
    .getByRole('button', {
      name: 'Drop 1 Card',
      exact: true,
    })
    .click()
  await expect(history.locator('li')).toHaveCount(21)
  expect(await history.evaluate((el) => el.scrollTop)).toBe(before)
  await expect(history.locator('.latest-event')).toContainText(
    'automatically drew a card',
  )
  await page.reload()
  await page.getByRole('button', { name: 'View Full History' }).click()
  await expect(
    page.getByRole('list', { name: 'Full game history' }).locator('li'),
  ).toHaveCount(21)
})
for (const [width, count] of [
  [1440, 5],
  [320, 3],
])
  test(`compact history shows ${count} events at ${width}px and Joker uses original art`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await load(page, fixture())
    const recent = page.getByRole('list', { name: 'Recent game activity' })
    await expect(recent.locator('li')).toHaveCount(count)
    await expect(recent.locator('.latest-event')).toHaveCount(1)
    await expect(recent.locator('li').first()).toHaveClass('latest-event')
    const joker = page.getByRole('img', { name: 'Printed Joker', exact: true })
    await expect(joker).not.toContainText('PJ')
    await expect(joker.locator('svg')).toHaveCount(1)
    await expect(joker).toContainText('JOKER')
    await page.getByRole('button', { name: 'View Full History' }).click()
    await expect(
      page.getByRole('list', { name: 'Full game history' }).locator('li'),
    ).toHaveCount(20)
    await page.getByRole('button', { name: 'Recent Activity' }).click()
    await expect(recent.locator('li')).toHaveCount(count)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/least-count-activity-${width}.png`,
      fullPage: true,
    })
  })
