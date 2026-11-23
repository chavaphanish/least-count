import { expect, test, type Page } from '@playwright/test'
import { mock } from './career-fixture'
import { auditGame } from './ux-fixture'
import { SESSION_KEY } from '../src/lib/session'
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
    await expect(page.getByRole('heading', { name: /Seven Cards/ })).toBeVisible()
    await expect(page.locator('.signed-out-lounge .brand-wordmark, .signed-out-lounge .brand-subtitle')).toHaveCount(0)
    await expect(page.locator('.access-promise span')).toHaveText(['Seven Cards.', 'One Goal.', 'Lowest Score Wins!'])
    await expect(page.getByText(/Challenge your friends, outsmart your opponents/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Play Game', exact: true })).toHaveCount(0)
    await expect(page.getByText('Sign up to join the fun, sign in to continue your journey, or play as a guest to jump straight into the action!', { exact: true })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav.getByRole('link')).toHaveCount(0)
    await expect(nav.getByRole('button')).toHaveCount(0)
    await expect(page.locator('.access-footer .brand-copyright')).toHaveText(/^© 2026 Chavium Games Pvt\. Ltd\. \| ver\. /)
    await expect(page.locator('.nav-brand')).toHaveText('YAYDU · The Game of Sevens')
    await expect(page.locator('.header-wordmark')).toHaveCSS('color', 'rgb(233, 205, 145)')
    await expect(page.locator('.header-brand-tagline')).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(page.locator('.header-brand-tagline')).toHaveCSS('font-weight', '700')
    const brand = await page.locator('.nav-brand').evaluate(el => {
      const logo = el.querySelector('.studio-logo')!.getBoundingClientRect(), text = el.querySelector('.header-wordmark')!.getBoundingClientRect()
      return { ratio: text.height / logo.height, alignment: Math.abs(text.y + text.height / 2 - logo.y - logo.height / 2), gap: parseFloat(getComputedStyle(el).gap) }
    })
    expect(brand.ratio).toBeCloseTo(.9, 1)
    expect(brand.alignment).toBeLessThan(1)
    expect(brand.gap).toBeLessThan(4)
    await fits(page)
    await page.evaluate(() => document.fonts.ready)
    const proportions = await page.locator('.signed-out-lounge').evaluate(root => {
      const tagline = root.querySelector('.access-promise')!.getBoundingClientRect(), box = root.getBoundingClientRect(), footer = root.querySelector('.access-footer')!.getBoundingClientRect()
      const logo = document.querySelector('.site-header .studio-logo')!.getBoundingClientRect(), header = document.querySelector('.site-header')!.getBoundingClientRect()
      const text = root.querySelector('.access-invitation')!.getBoundingClientRect(), form = root.querySelector('.access-card')!.getBoundingClientRect()
      return { left: Math.abs(tagline.left - root.querySelector('.access-story')!.getBoundingClientRect().left) < 1,
        fontSize: parseFloat(getComputedStyle(root.querySelector('.access-promise')!).fontSize),
        invitationCenter: Math.abs((text.y + text.height / 2) - (tagline.bottom + form.top) / 2),
        logoGap: header.bottom - logo.bottom, corners: getComputedStyle(root).borderRadius,
        box: box.bottom <= innerHeight, footer: footer.bottom <= box.bottom, nestedBorder: getComputedStyle(root.querySelector('.access-card')!).borderTopWidth }
    })
    expect(proportions).toMatchObject({ left: true, corners: width < 1000 ? '18px' : '24px', box: true, footer: true, nestedBorder: '0px' })
    expect(proportions.logoGap).toBeGreaterThan(4)
    expect(proportions.fontSize).toBeGreaterThan(width < 1000 ? 20 : 45)
    expect(proportions.invitationCenter).toBeLessThan(1)
    await page.getByRole('button', { name: 'Login as Guest', exact: true }).click(); await fits(page)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click(); await fits(page)
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click(); await fits(page)
    await page.getByLabel('First Name', { exact: true }).fill('John'); await page.getByLabel('Last Name', { exact: true }).fill('Smith')
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await fits(page)
    await page.getByLabel('Username', { exact: true }).fill('CardMaster99'); await page.getByLabel('Email address', { exact: true }).fill('john@example.test')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByLabel('Confirm Password', { exact: true })).toBeVisible(); await fits(page)
    if (width === 568) await page.screenshot({ path: '/tmp/yaydu-shared-branding-lounge-568.png' })
    await page.goto('/#/rules')
    await expect(page.getByRole('heading', { name: 'Know your table.' })).toBeVisible()
    await expect(nav.locator('a[aria-label="Home"]')).toHaveCount(0)
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
  await expect(nav.getByRole('link')).toHaveCount(0)
  await page.getByRole('button', { name: 'Login as Guest', exact: true }).click()
  await page.getByLabel('Display name', { exact: true }).fill('Guest Tester')
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click()
  await expect(page.locator('.lounge-home')).toBeVisible()
  await expect(page.locator('.signed-out-lounge')).toHaveCount(0)
  expect(await nav.locator(':scope > a, :scope > button').evaluateAll(els => els.map(el => el.getAttribute('aria-label') || el.textContent?.trim()))).toEqual(['Home', 'Leaderboards', 'Buddies', 'Mailbox', 'Settings'])
  await nav.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Leave Guest Session', exact: true }).click()
  await expect(page.locator('.signed-out-lounge')).toBeVisible()
  await expect(nav.getByRole('link')).toHaveCount(0)
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
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')).toHaveCount(0)
    const controls = await page.locator('.access-card input, .access-card button').evaluateAll(els => els.filter(el => el.checkVisibility() && !el.closest('[hidden]')).map(el => ({ text: el.textContent, bottom: el.getBoundingClientRect().bottom })))
    expect(controls.every(el => el.bottom <= 170)).toBe(true)
  } finally { await context.close() }
})


for (const path of ['/#/game', '/#/room/ABC234']) test(`direct gameplay route ${path} requires a confirmed session`, async ({ page }) => {
  await signedOut(page)
  if (path === '/#/game') await page.addInitScript(({key,game})=>sessionStorage.setItem(key,JSON.stringify(game)),{key:SESSION_KEY,game:auditGame(2,7)})
  await page.goto(path)
  await expect(page.locator('.signed-out-lounge')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start local game', exact: true })).toHaveCount(0)
  await expect(page.locator('.active-game')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.signed-out-lounge')).toBeVisible()
})

test('guest creation must succeed and session verification must finish before local gameplay opens', async ({ page }) => {
  await signedOut(page)
  const user = { player: { id: 'guest:test', displayName: 'Guest Tester', accountType: 'guest', avatarUrl: null }, email: null, createdAt: '2026-11-18T00:00:00Z', lastActiveAt: '2026-11-18T00:00:00Z' }
  let active = false, fail = true, verify = false
  await page.route('**/api/guest', route => {
    if (fail) return route.fulfill({ status: 503, json: { error: 'Guest creation unavailable.' } })
    active = true; return route.fulfill({ json: { user } })
  })
  await page.route('**/api/session', async route => {
    if (active) await new Promise(resolve => { const timer = setInterval(() => { if (verify) { clearInterval(timer); resolve(null) } }, 20) })
    return route.fulfill({ json: { user: active ? user : null, room: null } })
  })
  await page.goto('/#/game')
  await page.getByRole('button', { name: 'Login as Guest', exact: true }).click()
  await page.getByLabel('Display name', { exact: true }).fill('Guest Tester')
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Guest creation unavailable.')
  await expect(page.getByRole('button', { name: 'Start local game', exact: true })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Enter as guest', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Please wait…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Start local game', exact: true })).toHaveCount(0)
  verify = true
  await expect(page.getByRole('button', { name: 'Start local game', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start local game', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Your hand', exact: true })).toBeVisible()
})

test('failed session initialization cannot fall back to unauthenticated offline gameplay', async ({ page }) => {
  await signedOut(page)
  await page.route('**/api/session', route => route.fulfill({ status: 503, json: { error: 'Session service unavailable.' } }))
  await page.goto('/#/game')
  await expect(page.getByRole('alert')).toContainText('Session service unavailable.')
  await expect(page.getByRole('button', { name: 'Start local game', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Play offline practice', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Read the rules', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Know your table.', exact: true })).toBeVisible()
})


for (const accountType of ['guest', 'registered']) test(`confirmed ${accountType} session can open local practice without changing the signed-in header`, async ({ page }) => {
  const state = await mock(page)
  state.user.player.accountType = accountType
  await page.goto('/#/game')
  await expect(page.getByRole('button', { name: 'Start local game', exact: true })).toBeVisible()
  await expect(page.locator('.signed-out-lounge')).toHaveCount(0)
  await expect(page.locator('.site-header')).toHaveCSS('min-height', '108px')
  await expect(page.locator('.header-profile')).toBeVisible()
  await expect(page.locator('.signed-out-brand')).toHaveCount(0)
  await page.getByRole('button', { name: 'Start local game', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Your hand', exact: true })).toBeVisible()
})
