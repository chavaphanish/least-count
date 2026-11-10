import { expect, test } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { applyAction, createGame, latestGroup } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import { SESSION_KEY } from '../src/lib/session'
import { createCard } from '../src/game/cards'

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const android =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
const sizes = [
  { width: 667, height: 375 },
  { width: 800, height: 360 },
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 915, height: 412 },
  { width: 932, height: 430 },
  { width: 960, height: 432 },
]
mkdirSync('docs/mobile-layout', { recursive: true })
function fixture(count = 4, handSize = 7) {
  for (let seed = 1; seed < 2000; seed++) {
    let value = seed
    const game = createGame(
      [
        'You',
        'Alex',
        'Sam',
        'Robin',
        'Morgan',
        'Jamie',
        'Casey',
        'Taylor',
      ].slice(0, count),
      Date.now(),
      () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0
        return value / 4294967296
      },
    )
    if (
      game.current !== 0 ||
      game.phase !== 'turn' ||
      latestGroup(game)[0].rank === '7'
    )
      continue
    if (handSize > 7)
      game.players[0].hand.push(...game.drawPile.splice(0, handSize - 7))
    else game.drawPile.push(...game.players[0].hand.splice(handSize))
    game.events = Array.from({ length: 20 }, (_, i) => ({
      type: 'PILE_RECYCLED',
      id: `event-${i + 1}`,
      sequenceNumber: i + 1,
      roundNumber: 1,
      timestamp: Date.now(),
    }))
    game.eventSequence = 20
    return game
  }
  throw new Error('No fixture found')
}
async function load(page: Page, game: GameState) {
  await page.clock.install({ time: new Date(game.deadline! - 90_000) })
  await page.clock.pauseAt(new Date(game.deadline! - 59_999))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
    { key: SESSION_KEY, game },
  )
  await page.reload()
  await expect(page.locator('.mobile-game-bar')).toBeVisible()
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)!),
    SESSION_KEY,
  )
}
async function inside(locator: Locator) {
  // IntersectionObserver rounds fractional card dimensions (e.g. 0.99999988).
  await expect(locator).toBeInViewport({ ratio: 0.9999 })
  const box = (await locator.boundingBox())!
  const viewport = locator.page().viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(-0.5)
  expect(box.y).toBeGreaterThanOrEqual(-0.5)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5)
}
async function fits(page: Page) {
  const measured = await page.evaluate(() => {
    const required = [
      '.mobile-game-bar',
      '.live-table',
      '.opponent-row',
      '.live-piles',
      '.your-live-seat',
      '.turn-panel',
      '.compact-game-activity',
      '.mobile-game-bar .turn-clock',
    ]
    const elements = required.map((selector) => ({
      selector,
      element: document.querySelector(selector),
    }))
    for (const selector of [
      '.opponent-row > .live-opponent',
      '.adaptive-hand .hand-card',
      '.turn-actions .button',
      '.live-piles .sample-pile:not(.joker-indicator)',
    ]) {
      elements.push(
        ...Array.from(document.querySelectorAll(selector)).map((element) => ({
          selector,
          element,
        })),
      )
    }
    return {
      width: innerWidth,
      height: innerHeight,
      scroll: [scrollX, scrollY],
      document: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
      elements: elements.map(({ selector, element }) => {
        if (!element) return { selector, box: null }
        const r = element.getBoundingClientRect()
        return { selector, box: { x: r.x, y: r.y, w: r.width, h: r.height } }
      }),
    }
  })
  expect(measured.scroll).toEqual([0, 0])
  expect(measured.document).toEqual([measured.width, measured.height])
  for (const item of measured.elements) {
    expect(
      item.box,
      `missing essential element: ${item.selector}`,
    ).not.toBeNull()
    const r = item.box!
    expect(r.w, item.selector).toBeGreaterThan(0)
    expect(r.h, item.selector).toBeGreaterThan(0)
    expect(r.x, item.selector).toBeGreaterThanOrEqual(-0.5)
    expect(r.y, item.selector).toBeGreaterThanOrEqual(-0.5)
    expect(r.x + r.w, item.selector).toBeLessThanOrEqual(measured.width + 0.5)
    expect(r.y + r.h, item.selector).toBeLessThanOrEqual(measured.height + 0.5)
  }
}

test.describe('fixed landscape table', () => {
  test.setTimeout(120_000)
  test.use({ userAgent: iphone, isMobile: true, hasTouch: true })
  for (const size of sizes)
    for (const count of [2, 4, 6, 8])
      test(`${size.width} × ${size.height}, ${count} players, seven and twenty cards fit without page scrolling`, async ({
        page,
      }) => {
        await page.setViewportSize(size)
        const game = fixture(count)
        await load(page, game)
        await fits(page)
        await expect(
          page.locator('.opponent-row > .live-opponent'),
        ).toHaveCount(count - 1)
        expect(
          await page
            .locator('.opponent-row')
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true)
        const card = page.locator('.hand-card').first()
        await card.tap()
        await expect(card).toHaveAttribute('aria-pressed', 'true')
        await fits(page)
        if (count === 4 && size.width === 667)
          await page.screenshot({
            path: 'docs/mobile-layout/iphone-small-4.png',
          })
        if (count === 4 && size.width === 932)
          await page.screenshot({
            path: 'docs/mobile-layout/iphone-large-4.png',
          })
        const large = fixture(count, 20)
        await page.evaluate(
          ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
          { key: SESSION_KEY, game: large },
        )
        await page.reload()
        await fits(page)
        await expect(page.locator('.adaptive-hand .hand-card')).toHaveCount(20)
        await expect(
          page.getByRole('button', { name: 'Next hand page' }),
        ).toHaveCount(0)
        await fits(page)
        if (count === 8) {
          const largest = fixture(8)
          largest.players[0].hand.push(...largest.drawPile.splice(0))
          for (const other of largest.players.slice(1))
            largest.players[0].hand.push(...other.hand.splice(0))
          await page.evaluate(
            ({ key, game }) =>
              sessionStorage.setItem(key, JSON.stringify(game)),
            { key: SESSION_KEY, game: largest },
          )
          await page.reload()
          await expect(page.locator('.adaptive-hand .hand-card')).toHaveCount(
            104,
          )
          await fits(page)
          const blocked = await page
            .locator('.adaptive-hand .hand-card')
            .evaluateAll((buttons) =>
              buttons.flatMap((button) => {
                const r = button.getBoundingClientRect()
                const top = document.elementFromPoint(
                  r.x + Math.min(9, r.width / 2),
                  r.y + Math.min(12, r.height / 2),
                )
                return top === button || button.contains(top)
                  ? []
                  : [button.getAttribute('data-hand-card')]
              }),
            )
          expect(blocked).toEqual([])
        }
        await page.mouse.wheel(400, 400)
        expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0])
      })
  for (const handSize of [1, 7, 10, 15, 20, 25, 30, 44, 104])
    test(`${handSize}-card single row has reachable representations; extreme density is reported`, async ({
      page,
    }) => {
      await page.setViewportSize(sizes[0])
      const game = fixture(handSize > 44 ? 8 : 2, handSize)
      if (handSize === 104) {
        game.players[0].hand.push(...game.drawPile.splice(0))
        for (const other of game.players.slice(1))
          game.players[0].hand.push(...other.hand.splice(0))
        game.players[0].hand = game.players[0].hand.slice(0, 104)
      }
      await load(page, game)
      const visited: string[] = []
      for (const button of await page
        .locator('.adaptive-hand .hand-card')
        .all()) {
        await inside(button)
        const bounds = await button.boundingBox()
        expect(bounds!.width).toBeGreaterThanOrEqual(handSize <= 30 ? 18 : 1)
        expect(bounds!.height).toBeGreaterThanOrEqual(28)
        visited.push((await button.getAttribute('data-hand-card'))!)
        // Click the exposed corner, rather than an overlapping artwork rectangle.
        await button.tap({
          position: {
            x: Math.min(9, bounds!.width / 2),
            y: Math.min(12, bounds!.height / 2),
          },
        })
        await expect(button).toHaveAttribute('aria-pressed', 'true')
        await button.tap({
          position: {
            x: Math.min(9, bounds!.width / 2),
            y: Math.min(12, bounds!.height / 2),
          },
        })
        await expect(button).toHaveAttribute('aria-pressed', 'false')
      }
      if ([7, 15, 25, 104].includes(handSize))
        await page.screenshot({
          path: `docs/mobile-layout/hand-${handSize}.png`,
        })
      expect(visited).toEqual(game.players[0].hand.map((c) => c.id))
      await fits(page)
      if (handSize === 104) {
        await page.setViewportSize({ width: 375, height: 667 })
        await expect(page.getByRole('dialog', { name: 'Rotate Your Phone' })).toBeVisible()
        await expect(page.locator('.orientation-content')).toBeHidden()
        expect((await saved(page)).players[0].hand.map((c) => c.id)).toEqual(visited)
        await page.setViewportSize(sizes[0])
        await expect(page.locator('.adaptive-hand')).toBeVisible()
        await fits(page)
      }
    })
  test('matching selection survives resizing, rotation and secondary panels', async ({
    page,
  }) => {
    await page.setViewportSize(sizes[0])
    const game = fixture(2, 21)
    const hand = game.players[0].hand
    const rank = hand.find(
      (c) => hand.filter((other) => other.rank === c.rank).length > 1,
    )!.rank
    const matching = hand.filter((c) => c.rank === rank)
    const other = hand.filter((c) => c.rank !== rank)
    game.players[0].hand = [
      matching[0],
      ...other.slice(0, 9),
      ...matching.slice(1),
      ...other.slice(9),
    ]
    await load(page, game)
    const first = page.locator('.hand-card').first()
    await first.tap()
    await page.getByRole('button', { name: 'Select All Matching' }).tap()
    const ids = await page
      .locator('.hand-card[aria-pressed=true]')
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute('data-hand-card')),
      )
    const before = await saved(page)
    await page.getByRole('button', { name: 'Game Activity', exact: true }).tap()
    const dialog = page.getByRole('dialog', { name: 'Game Activity' })
    await expect(
      dialog.getByRole('list', { name: 'Recent game activity' }).locator('li'),
    ).toHaveCount(5)
    expect(
      await dialog
        .locator('li')
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute('data-event-id')),
        ),
    ).toEqual(['event-20', 'event-19', 'event-18', 'event-17', 'event-16'])
    await page.screenshot({ path: 'docs/mobile-layout/activity.png' })
    await dialog.getByRole('button', { name: 'View Full History' }).tap()
    await expect(
      dialog.getByRole('list', { name: 'Full game history' }).locator('li'),
    ).toHaveCount(20)
    await dialog.getByRole('button', { name: 'Close', exact: true }).tap()
    expect(await saved(page)).toEqual(before)
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(
      page.getByRole('dialog', { name: 'Rotate Your Phone' }),
    ).toBeVisible()
    await page.setViewportSize(sizes[0])
    expect(
      await page
        .locator('.hand-card[aria-pressed=true]')
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute('data-hand-card')),
        ),
    ).toEqual(ids)
    await page.getByRole('button', { name: 'Table options' }).tap()
    await expect(
      page.getByRole('dialog', { name: 'Table options' }),
    ).toContainText('Match scores')
    await page.keyboard.press('Escape')
    await page.locator('.opponent-row > .live-opponent').first().tap()
    await expect(page.getByRole('dialog', { name: /details/ })).toContainText(
      'cards stay private',
    )
    await page
      .getByRole('dialog', { name: /details/ })
      .getByRole('button', { name: 'Close', exact: true })
      .tap()
    expect(await saved(page)).toEqual(before)
  })
  test('replacement flight reaches the resized hand when crossing fourteen cards', async ({
    page,
  }) => {
    await page.setViewportSize(sizes[0])
    const game = fixture(2, 15)
    const index = game.players[0].hand.findIndex(
      (card) => card.rank !== '7' && card.rank !== latestGroup(game)[0].rank,
    )
    await load(page, game)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.locator('.hand-card').nth(index).tap()
    await page.locator('[data-plan-discard]').tap()
    await page.clock.runFor(700)
    await expect(page.locator('.hand-card')).toHaveCount(14)
    expect((await saved(page)).deadline).toBe(game.deadline)
    await page.getByRole('button', { name: 'Draw New Card', exact: true }).tap()
    await page.clock.runFor(100)
    await expect(page.locator('.flight-incoming')).toHaveCount(1)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const flight =
            document.querySelector<HTMLElement>('.flight-incoming')!
          const target = document.querySelector<HTMLElement>(
            '.hand-card.incoming-card-placeholder',
          )!
          const region = target
            .closest('.adaptive-hand')!
            .getBoundingClientRect()
          const x =
            parseFloat(flight.style.left) +
            parseFloat(flight.style.getPropertyValue('--flight-dx'))
          const y =
            parseFloat(flight.style.top) +
            parseFloat(flight.style.getPropertyValue('--flight-dy'))
          return Math.max(
            Math.abs(x - region.left - parseFloat(target.style.left)),
            Math.abs(y - region.top - parseFloat(target.style.top)),
          )
        }),
      )
      .toBeLessThan(1)
    const accepted = await saved(page)
    await page.clock.runFor(700)
    await expect(page.locator('.hand-card')).toHaveCount(15)
    await fits(page)
    expect(await saved(page)).toEqual(accepted)
  })
  test('safe areas and all action phases fit, with animations contained', async ({
    page,
  }) => {
    await page.setViewportSize(sizes[0])
    const game = fixture()
    await load(page, game)
    await page.locator('.app-shell').evaluate((el) => {
      const s = (el as HTMLElement).style
      s.setProperty('--mobile-safe-left', '44px')
      s.setProperty('--mobile-safe-right', '44px')
      s.setProperty('--mobile-safe-bottom', '21px')
    })
    await fits(page)
    const idx = game.players[0].hand.findIndex(
      (c) => c.rank !== '7' && c.rank !== latestGroup(game)[0].rank,
    )
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.locator('.hand-card').nth(idx).tap()
    await page.locator('[data-plan-discard]').tap()
    await page.clock.runFor(100)
    await expect(page.getByTestId('turn-animation')).toHaveCount(1)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight === innerHeight &&
          document.documentElement.scrollWidth === innerWidth,
      ),
    ).toBe(true)
    await page.clock.runFor(650)
    await inside(
      page.getByRole('button', { name: 'Draw New Card', exact: true }),
    )
    await page.screenshot({ path: 'docs/mobile-layout/replacement.png' })
    await page.getByRole('button', { name: 'Draw New Card', exact: true }).tap()
    await page.clock.runFor(700)
    await expect(page.getByTestId('turn-animation')).toHaveCount(0)
    const penalty = fixture()
    penalty.phase = 'penalty'
    penalty.sevens = { initiator: 1, participants: [1], amount: 4 }
    penalty.players[0].hand[0] = {
      ...createCard('clubs', '7'),
      id: 'seven-test',
    }
    penalty.discards.push([
      { ...createCard('hearts', '7'), id: 'active-seven-test' },
    ])
    penalty.eligible = []
    penalty.deadline = await page.evaluate(() => Date.now() + 60_000)
    await page.evaluate(
      ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
      { key: SESSION_KEY, game: penalty },
    )
    await page.reload()
    await fits(page)
    await inside(
      page.getByRole('button', { name: 'Draw 4 Penalty Cards', exact: true }),
    )
    const penaltyButton = await page.getByRole('button', { name: 'Draw 4 Penalty Cards', exact: true }).boundingBox()
    expect(penaltyButton!.height).toBeLessThanOrEqual(48)
    await page.screenshot({ path: 'docs/mobile-layout/power-seven.png' })
    const low = fixture()
    low.players[0].hand = [{ ...createCard('clubs', 'A'), id: 'ace-test' }]
    low.deadline = await page.evaluate(() => Date.now() + 60_000)
    await page.evaluate(
      ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
      { key: SESSION_KEY, game: low },
    )
    await page.reload()
    await inside(
      page.getByRole('button', { name: 'Declare Least', exact: true }),
    )
    await page.screenshot({ path: 'docs/mobile-layout/declare-least.png' })
  })
  test('rules and local setup both fit the shared fixed viewport', async ({
    page,
  }) => {
    await page.setViewportSize(sizes[0])
    await page.goto('/#/rules')
    await page.evaluate(() => window.scrollTo(0, 200))
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await expect(
      page.getByRole('combobox', { name: 'Rule sections' }),
    ).toBeVisible()
    await page.goto('/#/game')
    await page.getByRole('button', { name: 'Start local game' }).tap()
    await fits(page)
  })
  test('an open activity overlay does not pause a turn deadline', async ({
    page,
  }) => {
    await page.setViewportSize(sizes[0])
    await load(page, fixture(2))
    await page.getByRole('button', { name: 'Game Activity', exact: true }).tap()
    await page.clock.fastForward(60_000)
    expect((await saved(page)).phase).toBe('game-over')
    await expect(
      page.getByRole('dialog', { name: 'Game Activity' }),
    ).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Game Activity' })
      .getByRole('button', { name: 'Close', exact: true })
      .tap()
    await expect(page.locator('.round-summary')).toBeVisible()
  })
  test('every eligible open card remains reachable and animates from the pickup overlay', async ({
    page,
  }) => {
    await page.setViewportSize(sizes[0])
    const game = fixture(2)
    const rank = game.drawPile.find(
      (c) =>
        c.rank !== '7' &&
        game.drawPile.filter((other) => other.rank === c.rank).length >= 3,
    )!.rank
    const group = game.drawPile.filter((c) => c.rank === rank).slice(0, 3)
    game.drawPile = game.drawPile.filter(
      (c) => !group.some((other) => other.id === c.id),
    )
    game.discards.push(group)
    game.eligible = group.map((c) => c.id)
    const card = game.players[0].hand.find(
      (c) => c.rank !== '7' && c.rank !== rank,
    )!
    const waiting = applyAction(game, {
      type: 'discard',
      playerId: 'p0',
      cardIds: [card.id],
    })
    await load(page, waiting)
    await page
      .getByRole('button', { name: 'Choose an open card', exact: true })
      .tap()
    const dialog = page.getByRole('dialog', { name: 'Choose an open card' })
    await expect(dialog.locator('.pickup-button')).toHaveCount(3)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await dialog.locator('.pickup-button').last().tap()
    await page.clock.runFor(100)
    await expect(page.locator('.flight-incoming')).toHaveCount(1)
    expect(
      (await saved(page)).players[0].hand.some((c) => c.id === group[2].id),
    ).toBe(true)
    await page.clock.runFor(700)
    expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0])
  })
})

test('Android uses the same fixed layout and secondary overlays', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    userAgent: android,
    isMobile: true,
    hasTouch: true,
    viewport: sizes[4],
  })
  try {
    const page = await context.newPage()
    await load(page, fixture(8))
    await fits(page)
    await page.locator('.hand-card').first().tap()
    await page.screenshot({ path: 'docs/mobile-layout/android-8.png' })
    await page.getByRole('button', { name: 'Game Activity', exact: true }).tap()
    await expect(
      page.getByRole('dialog', { name: 'Game Activity' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await fits(page)
  } finally {
    await context.close()
  }
})
