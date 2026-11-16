import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'

for (const [width, height] of [[1440, 900], [844, 390], [667, 375], [568, 320]]) {
  test(`header career progress and navigation fit at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}) })
    try {
      const page = await context.newPage()
      const state = await mock(page)
      Object.assign(state.user.player, { firstName: 'Career', lastName: 'Tester', username: 'lc_owner' })
      await page.goto('/')
      const header = page.getByRole('banner')
      const profile = header.getByRole('link', { name: 'Your profile' })
      await expect(profile).toContainText('Career Tester')
      await expect(profile).toContainText('@lc_owner')
      await expect(profile.locator('.profile-avatar')).toBeVisible()
      await expect(profile).toContainText('Level 5')
      await expect(profile).toContainText('250 / 500 XP')
      const progress = profile.getByRole('progressbar', { name: 'Level progress' })
      await expect(progress).toHaveAttribute('value', '250')
      await expect(progress).toHaveAttribute('max', '500')
      await expect(progress).toBeVisible()
      await expect(page.getByRole('progressbar')).toHaveCount(1)
      const brandBox = await profile.boundingBox(), navBox = await header.getByRole('navigation').boundingBox()
      expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(navBox!.x)
      expect(await header.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      const barBox = await progress.boundingBox(), headerBox = await header.boundingBox()
      expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(headerBox!.y + headerBox!.height)
      await profile.click()
      await expect(page).toHaveURL(/#\/profile$/)
      await header.getByRole('link', { name: 'Lounge', exact: true }).click()
      await expect(page).toHaveURL(/#\/$/)
    } finally { await context.close() }
  })
}
