import { expect, test, type Page } from '@playwright/test'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function signedOut(page: Page) {
  await page.route('**/api/config', route => route.fulfill({ json: { service: 'least-count', supabase: { url: 'https://mock-project.supabase.co', publishableKey: 'sb_publishable_test' } } }))
  await page.route('**/api/session', route => route.fulfill({ json: { user: null, room: null } }))
  await page.route('**/api/auth/availability', route => route.fulfill({ json: { usernameAvailable: true, emailAvailable: true } }))
}
async function fits(page: Page) {
  const geometry = await page.locator('.signed-out-lounge').evaluate(root => {
    const welcome = root.querySelector('.access-story')!.getBoundingClientRect(), card = root.querySelector('.access-card')!.getBoundingClientRect(), footer = root.querySelector('.access-footer')!.getBoundingClientRect()
    const overflow = [...root.querySelectorAll('input, button, .access-story, .access-footer')].filter(el => el.checkVisibility() && !el.closest('[hidden]')).flatMap(el => {
      const r = el.getBoundingClientRect()
      return r.left < 0 || r.right > innerWidth + 1 || r.top < 0 || r.bottom > innerHeight + 1 ? [{ tag: el.tagName, text: el.textContent, bottom: r.bottom }] : []
    })
    return { stacked: welcome.bottom <= card.top && card.bottom <= footer.top && welcome.top >= document.querySelector('.site-header')!.getBoundingClientRect().bottom, width: welcome.width === card.width,
      noPageScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight, overflow }
  })
  expect(geometry).toEqual({ stacked: true, width: true, noPageScroll: true, overflow: [] })
}
for (const [width, height] of [[1280, 800], [844, 390], [667, 375], [568, 320], [480, 320]]) test(`signed-out Lounge stacks all form modes without scrolling at ${width}x${height}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: iphone } : {}) })
  try {
    const page = await context.newPage(); await signedOut(page); await page.goto('/')
    await expect(page.getByRole('heading', { name: 'YAYDU, The Game of Sevens.', exact: true })).toBeVisible()
    await expect(page.getByText('Seven cards. One goal. The lowest score wins!', { exact: true })).toBeVisible()
    await expect(page.getByText('Challenge your friends, outsmart your opponents, and master the game of sevens, where every card counts and every move matters.', { exact: true })).toBeVisible()
    await expect(page.getByText('Sign up to join the fun, sign in to continue your journey, or play as a guest to jump straight into the action!', { exact: true })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav.getByRole('link')).toHaveText(['Rules'])
    await expect(nav.getByRole('button')).toHaveCount(0)
    await expect(page.locator('.access-footer .brand-copyright')).toHaveText(/^© 2026 Chavium Games Pvt\. Ltd\. \| ver\. /)
    await fits(page)
    await page.getByRole('button', { name: 'Continue as Guest', exact: true }).click(); await fits(page)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click(); await fits(page)
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click(); await fits(page)
    await page.getByLabel('First Name', { exact: true }).fill('John'); await page.getByLabel('Last Name', { exact: true }).fill('Smith')
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await fits(page)
    await page.getByLabel('Username', { exact: true }).fill('CardMaster99'); await page.getByLabel('Email address', { exact: true }).fill('john@example.test')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByLabel('Confirm Password', { exact: true })).toBeVisible(); await fits(page)
    if (width === 568) await page.screenshot({ path: '/tmp/yaydu-signed-out-568.png' })
    await page.getByRole('link', { name: 'Rules', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Know your table.' })).toBeVisible()
    await expect(nav.getByRole('link')).toHaveText(['Rules'])
  } finally { await context.close() }
})
test('guest entry and sign-out update navigation automatically while preserving the existing Lounge', async ({ page }) => {
  await signedOut(page)
  const user = { player: { id: 'guest:test', displayName: 'Guest Tester', accountType: 'guest', avatarUrl: null }, email: null, createdAt: '2026-11-18T00:00:00Z', lastActiveAt: '2026-11-18T00:00:00Z' }
  let active = false
  await page.route('**/api/session', route => route.fulfill({ json: { user: active ? user : null, room: null } }))
  await page.route('**/api/guest', route => { active = true; return route.fulfill({ json: { user, room: null } }) })
  await page.route('**/api/logout', route => { active = false; return route.fulfill({ json: { ok: true } }) })
  await page.goto('/'); const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link')).toHaveText(['Rules'])
  await page.getByRole('button', { name: 'Continue as Guest', exact: true }).click()
  await page.getByLabel('Display name', { exact: true }).fill('Guest Tester')
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click()
  await expect(page.locator('.lounge-home')).toBeVisible()
  await expect(page.locator('.signed-out-lounge')).toHaveCount(0)
  expect(await nav.locator(':scope > a, :scope > button').evaluateAll(els => els.map(el => el.getAttribute('aria-label') || el.textContent?.trim()))).toEqual(['Rules', 'Lounge', 'Leaderboards', 'Buddies', 'Mailbox', 'Settings'])
  await nav.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Leave Guest Session', exact: true }).click()
  await expect(page.locator('.signed-out-lounge')).toBeVisible()
  await expect(nav.getByRole('link')).toHaveText(['Rules'])
  await expect(nav.getByRole('button')).toHaveCount(0)
})

test('keyboard keeps the focused form usable without exposing signed-out navigation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, userAgent: iphone })
  try {
    const page = await context.newPage(); await signedOut(page); await page.goto('/')
    const input = page.getByLabel('Email or Username', { exact: true })
    await input.fill('John'); await input.focus()
    await page.evaluate(() => { Object.defineProperty(visualViewport!, 'height', { configurable: true, get: () => 170 }); visualViewport!.dispatchEvent(new Event('resize')) })
    await expect(page.locator('[data-keyboard]')).toHaveCount(1)
    await expect(input).toBeFocused(); await expect(input).toHaveValue('John')
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')).toHaveText(['Rules'])
    const controls = await page.locator('.access-card input, .access-card button').evaluateAll(els => els.filter(el => el.checkVisibility() && !el.closest('[hidden]')).map(el => ({ text: el.textContent, bottom: el.getBoundingClientRect().bottom })))
    expect(controls.every(el => el.bottom <= 170)).toBe(true)
  } finally { await context.close() }
})
