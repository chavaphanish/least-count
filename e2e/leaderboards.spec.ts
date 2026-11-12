import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'

for (const [width, height, mobile] of [[1280, 800, false], [1024, 768, true], [844, 390, true], [667, 375, true]] as const) {
  test.describe(`Leaderboards ${width}x${height}`, () => {
    test.use({ viewport: { width, height }, ...(mobile ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}) })
    test('ranking layout, scope switching, player details and Lounge navigation', async ({ page }) => {
      const { me, friend } = await mock(page)
      await page.route('**/api/career?op=leaderboard**', route => {
        const buddies = new URL(route.request().url()).searchParams.get('scope') === 'buddies'
        return route.fulfill({ json: { me, players: [{ ...friend, firstName: buddies ? 'Buddy' : 'Global', lastName: 'Player' }], more: false } })
      })
      await page.goto('/')
      await page.getByRole('button', { name: 'Leaderboards', exact: true }).click()
      await expect(page).toHaveURL(/#\/leaderboards$/)
      await expect(page.getByRole('heading', { name: 'Leaderboards', exact: true })).toBeVisible()
      await expect(page).toHaveTitle('YAYDU — Leaderboards')
      await expect(page.getByText(/THE LONG GAME|XP Ranking|Participation and victories|Back to Lounge/)).toHaveCount(0)
      const global = page.getByRole('button', { name: 'Global Ranking', exact: true }), buddies = page.getByRole('button', { name: 'Buddies Ranking', exact: true })
      await expect(global).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.top-player')).toContainText('Global Player')
      await expect(page.locator('.ranking-list')).toContainText('#1')
      await expect(page.locator('.ranking-list')).toContainText('@lc_other')
      await expect(page.locator('.ranking-list')).toContainText('1,500 XP')
      await expect(page.locator('.ranking-list')).toContainText('18 wins')
      const first = (await global.boundingBox())!, second = (await buddies.boundingBox())!, results = (await page.locator('.leaderboard-results').boundingBox())!
      expect(first.width).toBeCloseTo(second.width, 0); expect(first.height).toBe(second.height)
      if (width > 700) {
        expect(second.y).toBeGreaterThan(first.y + first.height)
        expect(results.x).toBeGreaterThan(first.x + first.width)
        expect(results.width / first.width).toBeCloseTo(3, 0)
      } else {
        expect(second.y).toBe(first.y)
        expect(results.y).toBeGreaterThanOrEqual(first.y + first.height)
      }
      if (width === 1280 || width === 667) await page.screenshot({ path: `/tmp/yaydu-leaderboards-${width}.png`, fullPage: true })
      await buddies.click()
      await expect(buddies).toHaveAttribute('aria-pressed', 'true')
      await expect(global).toHaveAttribute('aria-pressed', 'false')
      await expect(page.locator('.ranking-list')).toContainText('Buddy Player')
      await expect(page.getByText(/Your Buddies Rank: #124/)).toBeVisible()
      await expect(page).toHaveURL(/#\/leaderboards$/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (mobile) {
        const bottom = (await page.locator('.career-pagination').boundingBox())!
        expect(bottom.y + bottom.height).toBeLessThanOrEqual(height)
      }
      await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      await expect(page.locator('.dashboard-page[data-mode=home]')).toBeVisible()
      await expect(page.locator('.leaderboard')).toHaveCount(0)
      await page.goBack()
      await expect(page.getByRole('heading', { name: 'Leaderboards', exact: true })).toBeVisible()
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Leaderboards', exact: true })).toBeVisible()
    })
  })
}

test('loading, retry and empty rankings remain available', async ({ page }) => {
  await mock(page)
  let fail = true
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/career?op=leaderboard**', async route => {
    await pending
    return route.fulfill(fail ? { status: 503, json: { error: 'Rankings temporarily unavailable' } } : { json: { players: [], me: null, more: false } })
  })
  await page.goto('/#/leaderboards')
  await expect(page.getByText('Loading rankings…')).toBeVisible()
  release()
  await expect(page.getByText('Rankings temporarily unavailable')).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry rankings' }).click()
  await expect(page.getByText('No registered players in this ranking yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next players' })).toBeDisabled()
})

test('guest ranking access preserves the verified-account prompt', async ({ page }) => {
  const { user } = await mock(page)
  user.player.accountType = 'guest'
  await page.goto('/#/leaderboards')
  await expect(page.locator('.ranking-list')).toContainText('@lc_other')
  await page.getByRole('button', { name: 'Buddies Ranking', exact: true }).click()
  await expect(page.getByText('Create a verified account to compare with buddies.')).toBeVisible()
  await page.getByRole('link', { name: 'Lounge', exact: true }).click()
  await expect(page.locator('.dashboard-page[data-mode=home]')).toBeVisible()
})
