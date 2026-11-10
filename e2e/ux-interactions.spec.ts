import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { auditGame } from './ux-fixture'
import { mock } from './career-fixture'
import { profileView } from './ux-navigation'
import { SESSION_KEY } from '../src/lib/session'
import type { GameState } from '../src/game/engine'
const sizes = [
  { width: 667, height: 375 },
  { width: 800, height: 360 },
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 915, height: 412 },
  { width: 932, height: 430 },
  { width: 960, height: 432 },
]
const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
test.use({
  userAgent: iphone,
  isMobile: true,
  hasTouch: true,
  viewport: sizes[0],
})
async function load(page: Page, game: GameState) {
  game.settings = { timedGame: false, eliminationThreshold: 100 }
  game.deadline = null
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
    { key: SESSION_KEY, game },
  )
  await page.reload()
  await expect(page.locator('.active-game')).toBeVisible()
}
async function controlsFit(page: Page, selector: string) {
  const bad = await page.locator(selector).evaluate((root) =>
    Array.from(root.querySelectorAll('button,select'))
      .filter((el) => el.checkVisibility() && !el.closest('[hidden]'))
      .flatMap((el) => {
        const r = el.getBoundingClientRect(),
          top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return r.top < 0 ||
          r.left < 0 ||
          r.bottom > innerHeight + 0.5 ||
          r.right > innerWidth + 0.5 ||
          !(top === el || el.contains(top))
          ? [el.textContent?.trim()]
          : []
      }),
  )
  expect(bad).toEqual([])
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]),
  ).toEqual([page.viewportSize()!.width, page.viewportSize()!.height])
}
for (const size of sizes)
  test(`one-row 30-card hand and actions remain touchable at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize(size)
    await load(page, auditGame(8, 30))
    const hand = page.locator('.adaptive-hand')
    await expect(hand).toHaveAttribute('data-rows', '1')
    const boxes = await hand.locator('.hand-card').evaluateAll((cards) =>
      cards.map((card) => {
        const r = card.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      }),
    )
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1)
    for (const [index, box] of boxes.entries()) {
      expect(box.w).toBeGreaterThanOrEqual(18)
      await page.touchscreen.tap(box.x + box.w / 2, box.y + 12)
      await expect(hand.locator('.hand-card').nth(index)).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await page.touchscreen.tap(box.x + box.w / 2, box.y + 12)
      await expect(hand.locator('.hand-card').nth(index)).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    }
    await controlsFit(page, '.turn-panel')
  })
test('extreme single row supports inspection, cancellation and release selection', async ({
  page,
}) => {
  const game = auditGame(8)
  game.players[0].hand.push(...game.drawPile.splice(0))
  for (const p of game.players.slice(1))
    game.players[0].hand.push(...p.hand.splice(0))
  await load(page, game)
  const hand = page.locator('.adaptive-hand')
  await expect(hand).toHaveAttribute('data-rows', '1')
  await expect(hand).toHaveAttribute('data-density', 'compact')
  await expect(hand.locator('.hand-card')).toHaveCount(104)
  const before = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    SESSION_KEY,
  )
  const bounds = (await hand.locator('.hand-card').nth(30).boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 12)
  await page.mouse.down()
  await expect(page.locator('.hand-inspection')).toContainText('31/104')
  await page.mouse.up()
  await expect(hand.locator('.hand-card').nth(30)).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY),
  ).toBe(before)
  await hand.dispatchEvent('pointercancel', { pointerId: 1 })
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY),
  ).toBe(before)
})
test('eight-player results keep actions visible while all scores paginate', async ({
  page,
}) => {
  const game = auditGame(8)
  game.phase = 'round-over'
  game.result = {
    reason: 'show',
    caller: 'p0',
    successful: true,
    winners: ['p0'],
    scores: game.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      total: i,
      penalty: i,
      score: i,
      eliminated: false,
    })),
  }
  await load(page, game)
  for (const size of sizes) {
    await page.setViewportSize(size)
    await expect
      .poll(() =>
        page
          .locator('.app-shell')
          .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
      )
      .toBe(size.width)
    await controlsFit(page, '.round-summary')
  }
  await expect(page.locator('.score-table tbody tr:visible')).toHaveCount(4)
  await page.getByRole('button', { name: 'Next scores' }).click()
  await expect(page.locator('.score-table tbody')).toContainText('Taylor')
  await controlsFit(page, '.round-summary')
  await page.getByRole('button', { name: 'Start round 2', exact: true }).click()
  await expect(page.locator('.hand-card')).toHaveCount(7)
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key)!).round,
      SESSION_KEY,
    ),
  ).toBe(2)
})
test('activity and table details paginate without scrolling or mutating the game', async ({
  page,
}) => {
  await load(page, auditGame(8, 25))
  const before = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    SESSION_KEY,
  )
  await page.getByRole('button', { name: 'Game Activity', exact: true }).click()
  await expect(
    page
      .getByRole('list', { name: 'Recent game activity' })
      .locator('li:visible'),
  ).toHaveCount(5)
  await controlsFit(page, 'dialog[open]')
  await page.getByRole('button', { name: 'View Full History' }).click()
  await expect(
    page.getByRole('list', { name: 'Full game history' }).locator('li:visible'),
  ).toHaveCount(3)
  await page.getByRole('button', { name: 'Next activities' }).click()
  await controlsFit(page, 'dialog[open]')
  expect(
    await page
      .locator('.table-overlay-body')
      .evaluateAll((nodes) =>
        nodes.every((el) => el.scrollHeight <= el.clientHeight + 1),
      ),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Table options' }).click()
  await page.getByRole('combobox', { name: 'Table sections' }).selectOption('1')
  await page.getByRole('button', { name: 'Next scores' }).click()
  await controlsFit(page, 'dialog[open]')
  await page.keyboard.press('Escape')
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY),
  ).toBe(before)
})
test('profile draft survives section changes and declined navigation', async ({
  page,
}) => {
  await mock(page)
  await page.goto('/#/profile')
  await profileView(page, '1')
  await page.getByLabel('Display name', { exact: true }).fill('Unsent draft')
  await profileView(page, '2')
  await profileView(page, '1')
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
    'Unsent draft',
  )
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Discard unsaved')
    await dialog.dismiss()
  })
  await page.getByRole('link', { name: 'Rules', exact: true }).click()
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
    'Unsent draft',
  )
  await expect(page).toHaveURL(/#\/profile$/)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('link', { name: 'Rules', exact: true }).click()
  await expect(page).toHaveURL(/#\/rules$/)
})

test('complete guest room journey reaches results, then existing career screens', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)
  const peerContext = await browser.newContext({
    baseURL,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
    viewport: sizes[4],
  })
  const peer = await peerContext.newPage()
  const guest = async (p: Page, name: string) => {
    await p.emulateMedia({ reducedMotion: 'reduce' })
    await p.goto('/')
    await p
      .getByRole('button', { name: 'Continue as Guest', exact: true })
      .click()
    await p.getByLabel('Display name', { exact: true }).fill(name)
    await p.getByRole('button', { name: 'Enter as guest', exact: true }).click()
    await expect(
      p.getByRole('heading', { name: `Welcome, ${name}.` }),
    ).toBeVisible()
  }
  try {
    await guest(page, 'UX Host')
    await guest(peer, 'UX Buddy')
    await page.getByRole('button', { name: 'Create Game Room' }).click()
    await page.getByLabel('Number of players').selectOption('2')
    await page.getByLabel('Elimination cutoff').fill('1')
    await page.getByLabel('Timed game').uncheck()
    await page.getByRole('button', { name: 'Create Room', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Waiting lobby' }),
    ).toBeVisible()
    const code = (await page.locator('.room-code-panel strong').textContent())!
    await peer.getByRole('button', { name: 'Join Game Room' }).click()
    await peer.getByLabel('Room code', { exact: true }).fill(code)
    await peer.getByRole('button', { name: 'Join Room', exact: true }).click()
    await page.getByRole('button', { name: 'Start Game', exact: true }).click()
    const pages = [page, peer]
    for (const p of pages) await expect(p.locator('.live-table')).toBeVisible()
    const ids = await Promise.all(
      pages.map(
        async (p) =>
          (await (await p.request.get('/api/session')).json()).user.player
            .id as string,
      ),
    )
    const view = async (p: Page) =>
      (await (
        await p.request.get(`/api/rooms/${code}`)
      ).json()) as import('../src/shared/multiplayer').RoomView
    let actions = 0
    while (actions++ < 200) {
      const common = await view(page),
        g = common.game!
      if (g.phase === 'game-over') break
      if (g.phase === 'round-over') {
        await page
          .getByRole('button', {
            name: `Start round ${g.round + 1}`,
            exact: true,
          })
          .click()
        continue
      }
      const actor = pages[ids.indexOf(g.currentPlayerId)],
        before = await view(actor),
        own = before.game!
      if (
        own.currentPlayerId !== ids[pages.indexOf(actor)] ||
        !['turn', 'draw', 'penalty'].includes(own.phase)
      )
        continue
      if (own.canShow)
        await actor
          .getByRole('button', { name: 'Declare Least', exact: true })
          .click()
      else if (own.phase === 'draw')
        await actor
          .getByRole('button', { name: 'Draw New Card', exact: true })
          .click()
      else if (
        own.phase === 'penalty' &&
        !own.hand.some((c) => c.rank === '7')
      ) {
        /* Existing server auto-accepts this penalty. */
      } else {
        const ranks = [...new Set(own.hand.map((c) => c.rank))]
        const rank =
          own.phase === 'penalty'
            ? '7'
            : ranks.sort(
                (a, b) =>
                  own.hand.filter((c) => c.rank === b).length -
                  own.hand.filter((c) => c.rank === a).length,
              )[0]
        for (const card of own.hand.filter((c) => c.rank === rank))
          await actor.locator(`[data-hand-card="${card.id}"]`).click()
        await actor.locator('[data-plan-discard]').click()
      }
      await expect
        .poll(async () => (await view(actor)).revision)
        .toBeGreaterThan(before.revision)
    }
    expect((await view(page)).game!.phase).toBe('game-over')
    await expect(page.locator('.round-summary')).toBeVisible()
    await controlsFit(page, '.round-summary')
    await page
      .getByRole('button', { name: 'Leave Room', exact: true })
      .last()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Welcome, UX Host.' }),
    ).toBeVisible()
    // Guest games are casual. Career navigation uses the existing registered-account fixture,
    // rather than claiming the guest match earned real XP or used a production account.
    await mock(page)
    await page.goto('/#/profile')
    await page.reload()
    await expect(
      page.getByRole('region', { name: 'Player career' }),
    ).toContainText('LEVEL 5')
    await page.getByRole('button', { name: 'Statistics', exact: true }).click()
    await page
      .getByRole('button', { name: 'Game History', exact: true })
      .click()
    await page.getByRole('button', { name: 'Buddies', exact: true }).click()
    await page.goto('/')
    await page
      .getByRole('button', { name: 'Leaderboards', exact: true })
      .click()
    await expect(page.getByText(/Your Global Rank/)).toBeVisible()
    await page
      .getByRole('button', { name: 'Buddies Ranking', exact: true })
      .click()
    await page.getByRole('button', { name: 'Back to dashboard' }).click()
    await expect(
      page.getByRole('heading', { name: 'Welcome, Career Tester.' }),
    ).toBeVisible()
  } finally {
    await peerContext.close()
  }
})

test('dashboard keeps an existing room return action and game tiles within the viewport', async ({
  page,
}) => {
  const { user } = await mock(page)
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { user, room: { code: 'ABC234', status: 'waiting' } },
    }),
  )
  await page.goto('/')
  for (const size of sizes) {
    await page.setViewportSize(size)
    await expect
      .poll(() =>
        page
          .locator('.app-shell')
          .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
      )
      .toBe(size.width)
    await expect(
      page.getByRole('link', { name: 'Return to your room →' }),
    ).toBeVisible()
    await controlsFit(page, 'main')
  }
})
