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
        const bottom = (await page.locator('.ranking-list').boundingBox())!
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
    test('five compact avatar-height rows scroll through every server batch', async ({ page }) => {
      const fixture = await mock(page)
      const { me, friend } = fixture
      if (width === 667) fixture.setRelationship('incoming')
      const longHandle = 'cardmaster'.repeat(2)
      await page.route('**/api/career?op=leaderboard**', route => {
        const query = new URL(route.request().url()).searchParams
        if (query.get('scope') === 'buddies') return route.fulfill({ json: { me, players: [{ ...friend, username: 'buddyplayer' }], more: false } })
        const offset = Number(query.get('offset') ?? 0)
        return route.fulfill({ json: {
          me: { ...me, rank: 4 }, more: offset === 0,
          players: Array.from({ length: offset === 0 ? 10 : 5 }, (_, index) => {
            const rank = offset + index + 1
            return { ...friend, id: rank === 4 ? me.id : `rank-${rank}`, rank,
              username: rank === 1 ? longHandle : `player${rank}`,
              firstName: rank === 1 ? 'A'.repeat(80) : 'Rank', lastName: `Player${rank}` }
          }),
        } })
      })
      await page.goto('/#/leaderboards')
      const list = page.getByRole('list', { name: 'Player rankings', exact: true })
      await expect(list.locator('li')).toHaveCount(10)
      await expect(list).toBeVisible()
      await expect(page.getByRole('button', { name: /Previous players|Next players/ })).toHaveCount(0)
      const layout = await list.evaluate(el => {
        const frame = el.getBoundingClientRect(), rows = [...el.querySelectorAll('li')].map(li => {
          const r = li.getBoundingClientRect(), avatar = li.querySelector('.profile-avatar')!.getBoundingClientRect()
          return { top: r.top, bottom: r.bottom, height: r.height, avatar: avatar.height }
        })
        return { frame: { top: frame.top, bottom: frame.bottom, height: el.clientHeight, width: el.clientWidth }, rows, width: el.scrollWidth, viewportHeight: innerHeight }
      })
      expect(layout.frame.height).toBeCloseTo(layout.rows[0].height * 5, 0)
      expect(layout.rows[0].height - layout.rows[0].avatar).toBeGreaterThanOrEqual(0)
      expect(layout.rows[0].height - layout.rows[0].avatar).toBeLessThanOrEqual(6)
      expect(layout.width).toBe(layout.frame.width)
      for (const row of layout.rows.slice(0, 5)) {
        expect(row.top).toBeGreaterThanOrEqual(layout.frame.top)
        expect(row.bottom).toBeLessThanOrEqual(layout.frame.bottom + 0.5)
      }
      if (mobile) expect(layout.frame.bottom).toBeLessThanOrEqual(layout.viewportHeight)
      await expect(list.locator('.current-player')).toHaveAttribute('aria-current', 'true')
      await expect(list.locator('li').first()).toContainText(`@${longHandle}`)
      await expect(list.locator('li').first()).toContainText('Level 6')
      await expect(list.locator('li').first()).toContainText('1,500 XP')
      await expect(list.locator('li').first()).toContainText('18 wins · 72% win rate')
      const identity = list.locator('li').first().getByRole('link')
      await expect(identity).toHaveAccessibleName(`${'A'.repeat(80)} Player1 (@${longHandle})`)
      await expect(identity.locator('.identity-primary')).toHaveCSS('text-overflow', 'ellipsis')
      await list.evaluate(el => { el.scrollTop = el.scrollHeight })
      await expect(list.locator('li')).toHaveCount(15)
      await expect(list.locator('li').first()).not.toBeInViewport()
      await list.focus(); await page.keyboard.press('End')
      await expect(list.locator('li').last()).toBeInViewport({ ratio: 1 })
      if (width === 1280 || width === 667) await page.screenshot({ path: `/tmp/yaydu-compact-rankings-${width}.png` })
      await page.getByRole('button', { name: 'Buddies Ranking', exact: true }).click()
      await expect(list.locator('li')).toHaveCount(1)
      await expect(list).toContainText('@buddyplayer')
      expect(await list.evaluate(el => el.scrollTop)).toBe(0)
      await page.getByRole('button', { name: 'Global Ranking', exact: true }).click()
      await expect(list.locator('li')).toHaveCount(10)
      await page.getByRole('button', { name: 'Global Ranking', exact: true }).click()
      await expect(list.locator('li')).toHaveCount(10)
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
  await expect(page.getByRole('button', { name: /Previous players|Next players/ })).toHaveCount(0)
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


test('a failed additional batch preserves loaded players and retries in the same frame', async ({ page }) => {
  const { me, friend } = await mock(page)
  let fail = true
  await page.route('**/api/career?op=leaderboard**', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? 0)
    if (offset && fail) return route.fulfill({ status: 503, json: { error: 'More rankings temporarily unavailable' } })
    return route.fulfill({ json: { me, more: offset === 0, players: Array.from({ length: offset ? 1 : 10 }, (_, index) => ({ ...friend, id: `player-${offset + index}`, rank: offset + index + 1, username: `player${offset + index + 1}` })) } })
  })
  await page.goto('/#/leaderboards')
  const list = page.getByRole('list', { name: 'Player rankings', exact: true })
  await expect(list.locator('li')).toHaveCount(10)
  await expect(list).toBeVisible()
  await list.evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect(page.getByText('More rankings temporarily unavailable')).toBeVisible()
  await expect(list.locator('li')).toHaveCount(10)
  fail = false
  await page.getByRole('button', { name: 'Retry rankings' }).click()
  await expect(list.locator('li')).toHaveCount(11)
  await list.evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect(list.locator('li').last()).toContainText('@player11')
  await expect(list.locator('li').last()).toBeInViewport({ ratio: 1 })
})
