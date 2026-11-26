import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'

for (const [width, height] of [[1440, 900], [844, 390], [667, 375], [480, 320]]) {
  test(`My Profile has two compact tabs without redundant identity or total XP at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: iphone } : {}) })
    try {
      const page = await context.newPage(), state = await mock(page)
      let requests = 0
      await page.route('**/api/career?op=profile*', route => {
        requests++
        return route.fulfill({ json: { profile: state.me, own: true, statistics: { gamesLost: 7, roundsPlayed: 100, roundsCompleted: 98, successfulDeclarations: 18, bestWinStreak: 5, currentWinStreak: 3, fullCycles: 4, sevenActions: 22, roundForfeits: 2, playingMs: 3600000 }, config: { levelBase: 50 } } })
      })
      await page.goto('/#/profile')
      const profile = page.getByRole('region', { name: 'My Profile', exact: true })
      await expect(profile.getByRole('heading', { name: 'My Profile', exact: true })).toHaveCount(0)
      await expect(profile.getByRole('tab')).toHaveText(['Overview', 'Stats'])
      await expect(profile.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true')
      await expect(profile.getByText('#124', { exact: true })).toBeVisible()
      await expect(profile.locator('.profile-avatar, .xp-progress, .history-list, .social-list, .identity-editor')).toHaveCount(0)
      await expect(profile).not.toContainText('Career Tester')
      await expect(profile).not.toContainText('1,250')
      await expect(profile).not.toContainText('XP')
      await expect(profile.getByText(/Progress reflects|Full 7 cycles/)).toHaveCount(0)
      await expect(profile.getByRole('link', {name:'Edit Profile'})).toHaveCount(0)
      await expect(profile.getByRole('tabpanel').locator('dl > div').filter({has:page.getByText('Win Rate',{exact:true})})).toHaveText('Win Rate72%')
      const first = (await profile.getByRole('tab', {name:'Overview'}).boundingBox())!
      const second = (await profile.getByRole('tab', {name:'Stats'}).boundingBox())!
      const content = (await profile.locator('.my-profile-content').boundingBox())!
      expect(second.y).toBeGreaterThan(first.y + first.height)
      expect(content.x).toBeGreaterThan(first.x + first.width)
      expect(Math.abs(second.y + second.height - content.y - content.height)).toBeLessThan(1)
      const header = page.getByRole('banner')
      await expect(header.getByRole('progressbar')).toHaveAttribute('value', '250')
      const headerMarkup = await header.innerHTML(), initialRequests = requests
      for (const tab of ['Overview', 'Stats']) {
        await profile.getByRole('tab', { name: tab, exact: true }).click()
        const panel = profile.getByRole('tabpanel', { name: tab, exact: true })
        await expect(panel).toBeVisible()
        const overflow = await profile.evaluate(root => [...root.querySelectorAll<HTMLElement>('.my-profile-content,[role=tabpanel],.my-profile-grid')].filter(el => el.checkVisibility()).filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => ({ class: el.className, width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight })))
        expect(overflow).toEqual([])
        if (width === 480) await page.screenshot({ path: `/tmp/my-profile-${tab.toLowerCase()}-480.png` })
        const outside = await profile.locator('h1,h2,button,a,dt,dd,p').evaluateAll(els => els.filter(el => el.checkVisibility()).filter(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 }).map(el => el.textContent))
        expect(outside).toEqual([])
        expect(await header.innerHTML()).toBe(headerMarkup)
      }
      expect(requests).toBe(initialRequests)
      const stats = profile.getByRole('tabpanel', { name: 'Stats', exact: true })
      await expect(stats.locator('dl > div').filter({ has: page.getByText('Losses', { exact: true }) })).toHaveText('Losses7')
      await expect(stats.locator('dl > div').filter({ has: page.getByText('Win rate', { exact: true }) })).toHaveText('Win rate72%')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      await profile.getByRole('tab', { name: 'Overview', exact: true }).focus()
      await page.keyboard.press('ArrowDown')
      await expect(profile.getByRole('tab', { name: 'Stats', exact: true })).toBeFocused()
      await expect(profile.getByRole('tab', { name: 'Stats', exact: true })).toHaveAttribute('aria-selected', 'true')
    } finally { await context.close() }
  })
}

test('Settings Profile deep link retains identity editing on reload', async ({ page }) => {
  const state = await mock(page)
  const identity = { username: 'cardmaster99', firstName: 'John', lastName: 'Smith', needsCompletion: false }
  Object.assign(state.user, { profile: identity }); Object.assign(state.user.player, identity)
  await page.route('**/api/username?**', route => route.fulfill({ json: { available: true } }))
  await page.route('**/api/profile/identity', route => {
    Object.assign(identity, route.request().postDataJSON()); Object.assign(state.user.player, identity)
    return route.fulfill({ json: { user: state.user } })
  })
  await page.goto('/#/settings/profile')
  await expect(page).toHaveURL(/#\/settings\/profile$/)
  await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('First Name', { exact: true }).fill('Jane')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByText('Your profile is saved.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Jane')
  await page.goto('/#/settings')
  await expect(page.getByRole('tab', { name: 'Account', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('empty career, loading failure and retry keep profile navigation usable', async ({ page }) => {
  const state = await mock(page)
  let failing = true
  await page.route('**/api/career?op=profile*', route => failing
    ? route.fulfill({ status: 503, json: { error: 'Career temporarily unavailable' } })
    : route.fulfill({ json: { profile: { ...state.me, xp: 0, gamesPlayed: 0, gamesWon: 0, rank: null }, statistics: {}, own: true, config: { levelBase: 50 } } }))
  await page.goto('/#/profile')
  const profile = page.getByRole('region', { name: 'My Profile', exact: true })
  await expect(profile.getByRole('status')).toContainText('Career temporarily unavailable')
  await expect(profile.getByRole('link', { name: 'Edit Profile', exact: true })).toHaveCount(0)
  failing = false
  await profile.getByRole('button', { name: 'Retry career data', exact: true }).click()
  await expect(profile.getByText('Unranked', { exact: true })).toBeVisible()
  await profile.getByRole('tab', { name: 'Stats', exact: true }).click()
  await expect(profile).not.toContainText('NaN')
  await expect(profile).not.toContainText('XP')
})

test('guest profile keeps its existing registered-account notice', async ({ page }) => {
  const state = await mock(page); state.user.player.accountType = 'guest'
  await page.goto('/#/profile')
  await expect(page.getByRole('heading', { name: 'Guest player', exact: true })).toBeVisible()
  await expect(page.getByText('Profile settings are available to registered accounts.', { exact: true })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Profile sections' })).toHaveCount(0)
})
