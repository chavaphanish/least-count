import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'
for (const mobile of [false, true]) {
  test.describe(mobile ? 'mobile Lounge' : 'desktop Lounge', () => {
    test.use(
      mobile
        ? {
            viewport: { width: 844, height: 390 },
            isMobile: true,
            hasTouch: true,
            userAgent:
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
          }
        : { viewport: { width: 1280, height: 800 } },
    )
    test('guest entry, return navigation and session restoration use Lounge', async ({
      page,
    }) => {
      await page.goto('/')
      await page
        .getByRole('button', { name: 'Continue as Guest', exact: true })
        .click()
      await page
        .getByLabel('Display name', { exact: true })
        .fill('Lounge Guest')
      await page
        .getByRole('button', { name: 'Enter as guest', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: 'Welcome, Lounge Guest.' }),
      ).toBeVisible()
      await expect(page).toHaveTitle('YAYDU — Lounge')
      const before = (await (await page.request.get('/api/session')).json())
        .user.player.id
      await page.getByRole('button', { name: 'Create Game Room' }).click()
      await page.getByRole('button', { name: 'Back to Lounge' }).click()
      await page.getByRole('link', { name: 'Rules', exact: true }).click()
      await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      await page.reload()
      await expect(
        page.getByRole('heading', { name: 'Welcome, Lounge Guest.' }),
      ).toBeVisible()
      expect(
        (await (await page.request.get('/api/session')).json()).user.player.id,
      ).toBe(before)
      await expect(page).toHaveTitle('YAYDU — Lounge')
      await expect(page.locator('body')).not.toContainText(/dashboard/i)
    })
    test('registered profile returns to Lounge and recovery keeps its existing link destination', async ({
      page,
    }) => {
      await mock(page)
      await page.goto('/#/profile')
      await expect(
        page.getByRole('region', { name: 'Player career' }),
      ).toBeVisible()
      await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      await expect(page).toHaveURL(/#\/$/)
      await expect(page).toHaveTitle('YAYDU — Lounge')
      await expect(
        page.getByRole('heading', { name: 'Welcome, Career Tester.' }),
      ).toBeVisible()
      await page.goto('/auth/callback?flow=recovery')
      // Recovery routing is deliberately unchanged in this terminology-only task.
      await expect(
        page.getByRole('link', { name: 'Back to Lounge', exact: true }),
      ).toHaveAttribute('href', '#/')
      await expect(page.locator('body')).not.toContainText(/dashboard/i)
    })
  })
}
