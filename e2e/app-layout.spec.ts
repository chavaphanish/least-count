import { expect, test } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'
import { profileView } from './ux-navigation'
import { mock } from './career-fixture'
const sizes = [
  { width: 667, height: 375 },
  { width: 800, height: 360 },
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 915, height: 412 },
  { width: 932, height: 430 },
  { width: 960, height: 432 },
]
test.use({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
})
async function viewportReady(page: Page) {
  // setViewportSize resolves before React necessarily commits the visualViewport event.
  await expect
    .poll(() =>
      page
        .locator('.app-shell')
        .evaluate((el) =>
          Math.abs(
            el.getBoundingClientRect().height -
              Math.round(visualViewport?.height ?? innerHeight),
          ),
        ),
    )
    .toBeLessThan(0.5)
}
async function insideVisualViewport(locator: Locator) {
  await viewportReady(locator.page())
  await expect(locator).toBeVisible()
  const bounds = (await locator.boundingBox())!
  const view = await locator.page().evaluate(() => ({
    width: visualViewport?.width ?? innerWidth,
    height: visualViewport?.height ?? innerHeight,
  }))
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(view.width + 0.5)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(view.height + 0.5)
}
async function fits(page: Page) {
  await viewportReady(page)
  const result = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll(
        'main button,main input,main select,main a,main [data-page-item],main .rule-tile,main .career-summary,main .account-details dt,main .account-details dd',
      ),
    ).filter((el) => el.checkVisibility() && !el.closest('[hidden]'))
    return {
      scroll: [scrollX, scrollY],
      document: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
      viewport: [innerWidth, innerHeight],
      bad: controls.flatMap((el) => {
        const r = el.getBoundingClientRect()
        return r.x < -0.5 ||
          r.y < -0.5 ||
          r.right > innerWidth + 0.5 ||
          r.bottom > innerHeight + 0.5
          ? [
              {
                text: el.textContent?.slice(0, 60),
                box: { x: r.x, y: r.y, w: r.width, h: r.height },
              },
            ]
          : []
      }),
    }
  })
  if (result.bad.length)
    await page.screenshot({ path: '/tmp/app-layout-failure.png' })
  expect(result.scroll).toEqual([0, 0])
  expect(result.document).toEqual(result.viewport)
  expect(result.bad).toEqual([])
}
for (const size of sizes)
  test(`application screens fit ${size.width}×${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(size)
    await mock(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Game Room' }).click()
    await expect(page.getByLabel('Number of players')).toBeVisible()
    await fits(page)
    if (size.width === 667)
      await page.screenshot({ path: 'docs/mobile-layout/create-game.png' })
    await page.getByRole('button', { name: 'Back to Lounge' }).click()
    await page.getByRole('button', { name: 'Join Game Room' }).click()
    await fits(page)
    await page.getByRole('button', { name: 'Back to Lounge' }).click()
    await fits(page)
    if (size.width === 667)
      await page.screenshot({ path: 'docs/mobile-layout/dashboard.png' })
    for (const mode of ['Leaderboards', 'Buddies', 'Settings']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      if (mode === 'Leaderboards') {
        await expect(page.getByText(/Your Global Rank/)).toBeVisible()
        await fits(page)
        await page.getByRole('button', { name: 'Buddies Ranking' }).click()
      }
      await fits(page)
      if (mode === 'Leaderboards') await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      else await page.getByRole('button', { name: 'Back to Lounge' }).click()
    }
    await page.goto('/#/profile')
    await expect(
      page.getByRole('region', { name: 'Player career' }),
    ).toBeVisible()
    await fits(page)
    const sections = page.getByRole('combobox', { name: 'Overview sections' })
    if (await sections.count())
      for (const value of await sections
        .locator('option')
        .evaluateAll((opts) =>
          opts.map((o) => (o as HTMLOptionElement).value),
        )) {
        await sections.selectOption(value)
        await fits(page)
      }
    for (const tab of ['Statistics', 'Game History', 'Buddies']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await fits(page)
      const selectors = page.locator('.career-tab-content select:visible')
      for (let i = 0; i < (await selectors.count()); i++) {
        const select = selectors.nth(i)
        for (const value of await select
          .locator('option')
          .evaluateAll((opts) =>
            opts.map((o) => (o as HTMLOptionElement).value),
          )) {
          await select.selectOption(value)
          await fits(page)
        }
      }
    }
    for (const value of ['1', '2']) {
      await profileView(page, value)
      await fits(page)
    }
    await page.goto('/#/history/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    await expect(
      page.getByRole('combobox', { name: 'Report sections' }),
    ).toBeVisible()
    await fits(page)
    await page
      .getByRole('combobox', { name: 'Report sections' })
      .selectOption('1')
    await fits(page)
    await page.goto('/#/player/lc_other')
    await expect(
      page.getByRole('region', { name: 'Player career' }),
    ).toBeVisible()
    await fits(page)
    await page.goto('/#/rules')
    const rules = page.getByRole('combobox', { name: 'Rule sections' })
    for (const value of await rules
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value))) {
      await rules.selectOption(value)
      await fits(page)
    }
  })
for (const size of sizes)
  test(`access modes fit ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.route('**/api/config', (r) =>
      r.fulfill({ json: { supabase: null, service: 'least-count' } }),
    )
    await page.route('**/api/session', (r) =>
      r.fulfill({ json: { user: null, room: null } }),
    )
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'Continue as Guest', exact: true }),
    ).toBeVisible()
    await fits(page)
    if (size.width === 667)
      await page.screenshot({ path: 'docs/mobile-layout/sign-in.png' })
    for (const mode of ['Sign Up', 'Continue as Guest']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await fits(page)
    }
  })
test('keyboard-sized signup steps retain values and submit verified email registration', async ({
  page,
}) => {
  await page.setViewportSize(sizes[0])
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        supabase: {
          url: 'https://mock-project.supabase.co',
          publishableKey: 'sb_publishable_test',
        },
        service: 'least-count',
      },
    }),
  )
  await page.route('**/api/session', (r) =>
    r.fulfill({ json: { user: null, room: null } }),
  )
  let submitted = false
  await page.route('https://mock-project.supabase.co/auth/v1/signup**', (r) => {
    expect(r.request().postDataJSON()).toMatchObject({
      email: 'new@example.test',
      password: 'test-only-password',
      data: { username: 'newplayer99', first_name: 'New', last_name: 'Player' },
    })
    submitted = true
    return r.fulfill({
      json: {
        user: { id: 'new-user', email: 'new@example.test', identities: [] },
        session: null,
      },
    })
  })
  await page.route('**/api/username?**', (r) =>
    r.fulfill({ json: { available: true } }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click()
  await page.getByLabel('Username', { exact: true }).fill('NewPlayer99')
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, 'height', {
      configurable: true,
      get: () => 170,
    })
    visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect(page.locator('[data-keyboard=true]')).toHaveCount(1)
  await insideVisualViewport(page.getByLabel('Username', { exact: true }))
  await insideVisualViewport(page.getByRole('button', { name: 'Next field' }))
  await page.getByRole('button', { name: 'Next field' }).click()
  await page.getByLabel('First Name', { exact: true }).fill('New')
  await page.getByRole('button', { name: 'Next field' }).click()
  await page.getByLabel('Last Name', { exact: true }).fill('Player')
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Email address').fill('new@example.test')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Password', { exact: true }).fill('test-only-password')
  await page.getByRole('button', { name: 'Next field' }).click()
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('test-only-password')
  await insideVisualViewport(
    page.getByRole('button', { name: 'Create account', exact: true }),
  )
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect.poll(() => submitted).toBe(true)
  await expect(page.getByRole('status')).toContainText('verification link')
  await insideVisualViewport(page.getByRole('status'))
  await insideVisualViewport(
    page.getByRole('button', { name: 'Create account', exact: true }),
  )
  await page.evaluate(() => {
    delete (visualViewport as unknown as { height?: number }).height
    visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect(page.locator('[data-keyboard=true]')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('verification link')
  await fits(page)
})
for (const reject of [false, true])
  test(`installed PWA requests landscape once, rejection=${reject}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ reject }) => {
        const original = window.matchMedia.bind(window)
        window.matchMedia = (query) =>
          query === '(display-mode: standalone)'
            ? ({ ...original(query), matches: true } as MediaQueryList)
            : original(query)
        ;(window as unknown as { locks: number }).locks = 0
        Object.defineProperty(screen.orientation, 'lock', {
          value: () => {
            ;(window as unknown as { locks: number }).locks++
            return reject
              ? Promise.reject(new Error('unsupported'))
              : Promise.resolve()
          },
        })
      },
      { reject },
    )
    await page.goto('/')
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { locks: number }).locks),
      )
      .toBe(1)
    await page.setViewportSize(sizes[0])
    await page.setViewportSize(sizes[2])
    expect(
      await page.evaluate(() => (window as unknown as { locks: number }).locks),
    ).toBe(1)
    await expect(
      page.getByRole('dialog', { name: 'Rotate Your Phone' }),
    ).toHaveCount(0)
  })
test('eight-player waiting room fits every landscape size', async ({
  page,
  playwright,
  baseURL,
}) => {
  test.setTimeout(90_000)
  const origin = baseURL!
  await page.request.post('/api/guest', {
    headers: { Origin: origin },
    data: { displayName: 'Mobile Host' },
  })
  const created = await page.request.post('/api/rooms', {
    headers: { Origin: origin },
    data: {
      maxPlayers: 8,
      eliminationThreshold: 100,
      timedGame: false,
      turnDurationSeconds: null,
    },
  })
  expect(created.ok()).toBe(true)
  const { code } = await created.json()
  const peers = []
  try {
    for (let i = 1; i < 8; i++) {
      const api = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { Origin: origin },
      })
      peers.push(api)
      expect(
        (
          await api.post('/api/guest', { data: { displayName: `Player ${i}` } })
        ).ok(),
      ).toBe(true)
      expect((await api.post(`/api/rooms/${code}/join`)).ok()).toBe(true)
    }
    await page.goto(`/#/room/${code}`)
    await expect(page.locator('.lobby-grid .lobby-player')).toHaveCount(8)
    for (const size of sizes) {
      await page.setViewportSize(size)
      await fits(page)
    }
    await page.setViewportSize(sizes[0])
    await page.screenshot({ path: 'docs/mobile-layout/lobby-8.png' })
    await expect(
      page.getByRole('button', { name: 'Start Game', exact: true }),
    ).toBeInViewport({ ratio: 1 })
  } finally {
    await Promise.all(peers.map((api) => api.dispose()))
  }
})
test('startup loading and retry screen fit', async ({ page }) => {
  await page.setViewportSize(sizes[0])
  await page.clock.install()
  await page.route('**/api/config', () => {})
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('Connecting')
  await fits(page)
  await page.screenshot({ path: 'docs/mobile-layout/loading.png' })
  await page.clock.fastForward(16_000)
  await expect(
    page.getByRole('button', { name: 'Retry initialization' }),
  ).toBeInViewport({ ratio: 1 })
  await fits(page)
})

test('ranking pages retain reachable players after viewport height changes', async ({
  page,
}) => {
  await page.setViewportSize(sizes[0])
  const state = await mock(page)
  await page.route('**/api/career?op=leaderboard**', (route) =>
    route.fulfill({
      json: {
        players: Array.from({ length: 10 }, (_, i) => ({
          ...state.friend,
          id: `rank-${i}`,
          displayName: `Rank Player ${i + 1}`,
          username: `lc_rank_${i + 1}`,
          rank: i + 1,
        })),
        me: state.me,
        more: false,
      },
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Leaderboards', exact: true }).click()
  await expect(page.locator('.ranking-list li')).toHaveCount(2)
  for (let i = 0; i < 4; i++)
    await page
      .getByRole('button', { name: 'Next players', exact: true })
      .click()
  await expect(
    page.getByRole('button', { name: 'Next players', exact: true }),
  ).toBeDisabled()
  await page.setViewportSize(sizes[5])
  await expect(page.locator('.ranking-list li')).toHaveCount(1)
  await expect(page.locator('.ranking-list')).toContainText('@lc_rank_10')
  await fits(page)
  await page
    .getByRole('button', { name: 'Previous players', exact: true })
    .click()
  await expect(page.locator('.ranking-list li')).toHaveCount(3)
  await fits(page)
})

test('create, join, profile and recovery fields fit a keyboard-reduced viewport', async ({
  page,
}) => {
  await page.setViewportSize(sizes[0])
  await mock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Game Room' }).click()
  await expect(page.getByLabel('Number of players')).toBeVisible()
  await expect(page.getByLabel('Elimination cutoff')).toBeVisible()
  await expect(page.getByLabel('Timed game')).toBeVisible()
  await page.getByLabel('Elimination cutoff').fill('150')
  const keyboard = () =>
    page.evaluate(() => {
      Object.defineProperty(visualViewport!, 'height', {
        configurable: true,
        get: () => 170,
      })
      visualViewport!.dispatchEvent(new Event('resize'))
    })
  const restore = () =>
    page.evaluate(() => {
      delete (visualViewport as unknown as { height?: number }).height
      visualViewport!.dispatchEvent(new Event('resize'))
    })
  await keyboard()
  await insideVisualViewport(page.getByLabel('Elimination cutoff'))
  await insideVisualViewport(page.getByRole('button', { name: 'Next field' }))
  await restore()
  await page.getByRole('button', { name: 'Back to Lounge' }).click()
  await page.getByRole('button', { name: 'Join Game Room' }).click()
  await page.getByLabel('Room code', { exact: true }).fill('ABC234')
  await keyboard()
  await insideVisualViewport(page.getByLabel('Room code', { exact: true }))
  await insideVisualViewport(
    page.getByRole('button', { name: 'Join Room', exact: true }),
  )
  await restore()
  await page.goto('/')
  await page.getByRole('button', { name: 'Buddies', exact: true }).click()
  await page.getByLabel('Find registered players').fill('Other Player')
  await keyboard()
  await insideVisualViewport(page.getByLabel('Find registered players'))
  await insideVisualViewport(
    page.getByRole('button', { name: 'Search players', exact: true }),
  )
  await restore()
  await page.goto('/#/profile')
  await profileView(page, '1')
  await page.getByLabel('Display name', { exact: true }).fill('Updated Tester')
  await keyboard()
  await insideVisualViewport(page.getByLabel('Display name', { exact: true }))
  await insideVisualViewport(page.getByRole('button', { name: 'Next field' }))
  await page.getByRole('button', { name: 'Next field' }).click()
  await insideVisualViewport(
    page.getByRole('button', { name: 'Save profile', exact: true }),
  )
  await restore()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.goto('/auth/callback?flow=recovery')
  await page.getByLabel('New password').fill('test-only-password')
  await keyboard()
  await insideVisualViewport(page.getByLabel('New password'))
  await insideVisualViewport(
    page.getByRole('button', { name: 'Save new password', exact: true }),
  )
  await restore()
  await fits(page)
})
