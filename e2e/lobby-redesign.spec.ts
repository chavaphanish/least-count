import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mock } from './career-fixture'
import type { RoomView } from '../src/shared/multiplayer'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function mockedLobby(page: Page, count = 8, host = true) {
  const fixture = await mock(page), now = Date.now()
  const room: RoomView = { id: 'lobby', code: 'ABC234', hostId: host ? fixture.user.player.id : 'other-host', settings: { maxPlayers: count, eliminationThreshold: 100, timedGame: true, turnDurationSeconds: 45 }, status: 'waiting', revision: 1, serverNow: now, members: [{ ...fixture.user.player, accountType: 'registered', order: 1, connected: true, lastSeen: now, disconnectedAt: null, authExpiresAt: now + 3600000, left: false }], game: null }
  await page.route('**/api/rooms/ABC234/join', route => route.fulfill({ json: room }))
  await page.route('**/api/rooms/ABC234/ticket', route => route.fulfill({ json: { ticket: 'test' } }))
  await page.routeWebSocket('**/api/rooms/ABC234/ws**', socket => {
    socket.send(JSON.stringify({ type: 'state', room }))
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw))
      if (message.type === 'action' && message.action.type === 'update-settings') {
        Object.assign(room.settings, message.action.settings); room.revision++
        socket.send(JSON.stringify({ type: 'state', room }))
        socket.send(JSON.stringify({ type: 'ack', requestId: message.requestId }))
      }
    })
  })
  return room
}
async function fits(page: Page) {
  const overflow = await page.locator('.lobby-page').evaluate(root => {
    const bad = [...root.querySelectorAll<HTMLElement>('button,select,h1,h2,h3,strong,.lobby-player')].filter(el => el.checkVisibility()).filter(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 })
    return { bad: bad.map(el => el.textContent), width: root.scrollWidth > root.clientWidth + 1, height: root.scrollHeight > root.clientHeight + 1, page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] }
  })
  expect(overflow.bad).toEqual([]); expect(overflow.width).toBe(false); expect(overflow.height).toBe(false)
  expect(overflow.page).toEqual(await page.evaluate(() => [innerWidth, innerHeight]))
}
for (const [width, height] of [[1440, 900], [844, 390], [667, 375], [568, 320], [480, 320]]) {
  test(`lobby settings and eight seats fit at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: iphone } : {}) })
    try {
      const page = await context.newPage(), room = await mockedLobby(page)
      await page.goto('/#/room/ABC234')
      await expect(page.getByRole('heading', { name: 'Waiting lobby' })).toBeVisible()
      await expect(page.getByLabel('Number of players')).toBeEnabled()
      await expect(page.locator('.lobby-player')).toHaveCount(8)
      await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Copy Code', exact: true })).toHaveCount(0)
      await fits(page)
      const player = await page.locator('[data-player-id]').elementHandle()
      await page.getByLabel('Number of players').selectOption('2')
      await expect(page.locator('.lobby-player')).toHaveCount(2)
      await page.getByLabel('Elimination threshold').selectOption('150')
      await expect(page.getByLabel('Elimination threshold')).toHaveValue('150')
      await page.getByLabel('Number of players').selectOption('8')
      await expect(page.locator('.lobby-player')).toHaveCount(8)
      expect(await player!.evaluate(el => el === document.querySelector('[data-player-id]'))).toBe(true)
      expect(room.settings.maxPlayers).toBe(8)
      await fits(page)
      if (width === 480 || width === 844) await page.screenshot({ path: `/tmp/yaydu-lobby-${width}.png` })
    } finally { await context.close() }
  })
}

test('native sharing is immediate, complete and cancellation produces no false success', async ({ page }) => {
  await mockedLobby(page)
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: (data: ShareData) => {
    Object.assign(window, { nativeShare: { data, active: navigator.userActivation.isActive } })
    return Promise.reject(new DOMException('Cancelled', 'AbortError'))
  } }))
  await page.goto('/#/room/ABC234')
  await page.getByRole('button', { name: 'Share Invitation', exact: true }).click()
  const shared = await page.evaluate(() => (window as unknown as { nativeShare: { data: ShareData; active: boolean } }).nativeShare)
  expect(shared.active).toBe(true)
  expect(shared.data.text).toContain('Room Code: ABC234')
  expect(shared.data.text).toContain('The Game of Sevens')
  expect(shared.data.url).toBe(new URL('/join/ABC234', page.url()).href)
  await expect(page.getByRole('dialog', { name: 'Share Invitation', exact: true })).not.toBeVisible()
  await expect(page.getByText(/Invitation copied|sent successfully/i)).toHaveCount(0)
})

test('clipboard fallback copies the complete invitation and manual fallback handles unavailable sharing', async ({ page }) => {
  await mockedLobby(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => { Object.assign(window, { copiedInvitation: text }); return Promise.resolve() } } })
  })
  await page.goto('/#/room/ABC234')
  await page.getByRole('button', { name: 'Share Invitation', exact: true }).click()
  await expect(page.getByText('Invitation copied. Paste it into your messaging app.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { copiedInvitation: string }).copiedInvitation)).toContain('/join/ABC234')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await page.getByRole('button', { name: 'Share Invitation', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Share Invitation', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Invitation message')).toHaveValue(/YAYDU[\s\S]*Room Code: ABC234[\s\S]*Join here: http/)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})

test('Host a Game creates once with defaults and enters the lobby without a configuration form', async ({ page }) => {
  await mockedLobby(page, 4)
  let creates = 0
  await page.route('**/api/rooms', async route => {
    creates++; expect(route.request().postDataJSON()).toEqual({ maxPlayers: 4, eliminationThreshold: 100, timedGame: true, turnDurationSeconds: 45 })
    return route.fulfill({ json: { code: 'ABC234' } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Host a Game', exact: true }).dblclick()
  await expect(page.getByRole('heading', { name: 'Waiting lobby' })).toBeVisible()
  expect(creates).toBe(1)
  await expect(page.getByLabel('Number of players')).toHaveValue('4')
  await expect(page.getByRole('button', { name: 'Create Room', exact: true })).toHaveCount(0)
})

test('guests remain subject to the existing online feature gate', async ({ page }) => {
  const fixture = await mock(page); fixture.user.player.accountType = 'guest'
  await page.goto('/')
  await page.getByRole('button', { name: 'Host a Game', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Multiplayer Online Mode for Guests')
  await page.getByRole('button', { name: 'OK', exact: true }).click()
})


test('failed room creation shows an error and allows a successful retry', async ({ page }) => {
  await mockedLobby(page, 4)
  let attempts = 0
  await page.route('**/api/rooms', route => ++attempts === 1
    ? route.fulfill({ status: 503, json: { error: 'Please retry hosting.' } })
    : route.fulfill({ json: { code: 'ABC234' } }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Host a Game', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Please retry hosting.')
  await page.getByRole('button', { name: 'Host a Game', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Waiting lobby' })).toBeVisible()
  expect(attempts).toBe(2)
})

test('eight occupied seats and invitation fallbacks fit the smallest landscape lobby', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 480, height: 320 }, isMobile: true, hasTouch: true, userAgent: iphone })
  try {
    const page = await context.newPage(), room = await mockedLobby(page)
    const first = room.members[0]
    room.members.push(...Array.from({ length: 7 }, (_, i) => ({ ...first, id: `player-${i}`, username: `longusername${i}`, firstName: 'Alexandria', lastName: 'Montgomery', order: i + 2 })))
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } })
    })
    await page.goto('/#/room/ABC234')
    await expect(page.locator('[data-player-id]')).toHaveCount(8)
    await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeEnabled()
    await fits(page)
    await page.getByRole('button', { name: 'Share Invitation', exact: true }).click()
    await expect(page.getByText('Invitation copied. Paste it into your messaging app.', { exact: true })).toBeVisible()
    await fits(page)
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
    await page.getByRole('button', { name: 'Share Invitation', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Share Invitation', exact: true })
    await expect(dialog).toBeVisible()
    const bounds = await dialog.boundingBox()
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(320)
  } finally { await context.close() }
})
