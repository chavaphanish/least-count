import { auditGame } from './ux-fixture'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { profileView } from './ux-navigation'
import { mock } from './career-fixture'
import { latestGroup, applyAction } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import { SESSION_KEY } from '../src/lib/session'
import { DEFAULT_ROOM_SETTINGS } from '../src/shared/multiplayer'
import type { RoomView } from '../src/shared/multiplayer'
const phase = process.env.UX_AUDIT_PHASE ?? 'after'
const folder = `docs/mobile-ux/${phase}`
mkdirSync(folder, { recursive: true })
async function gamePage(page: Page, game: GameState) {
  game.settings = { timedGame: false, eliminationThreshold: 100 }
  game.deadline = null
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
    { key: SESSION_KEY, game },
  )
  await page.reload()
  await expect(page.locator('.game-page.active-game')).toBeVisible()
}
test.use({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  viewport: { width: 667, height: 375 },
})
test('visual audit of all existing mobile surfaces', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  const records: unknown[] = []
  const shot = async (name: string, target = page) => {
    await target.evaluate(() => document.fonts.ready)
    await target.screenshot({
      path: `${folder}/${name}.jpg`,
      type: 'jpeg',
      quality: 85,
    })
    records.push({
      name,
      ...(await target.evaluate(() => ({
        viewport: [innerWidth, innerHeight],
        document: [
          document.documentElement.scrollWidth,
          document.documentElement.scrollHeight,
        ],
        outside: Array.from(
          document.querySelectorAll(
            'main button,main input,main select,dialog[open] button',
          ),
        )
          .filter((el) => el.checkVisibility() && !el.closest('[hidden]'))
          .flatMap((el) => {
            const r = el.getBoundingClientRect()
            return r.left < -0.5 ||
              r.top < -0.5 ||
              r.right > innerWidth + 0.5 ||
              r.bottom > innerHeight + 0.5
              ? [
                  {
                    label:
                      el.getAttribute('aria-label') ?? el.textContent?.trim(),
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                  },
                ]
              : []
          }),
      }))),
    })
  }
  page.on('dialog', (dialog) => void dialog.accept())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = await mock(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  await shot('dashboard')
  for (const mode of ['Set the Table', 'Take a Seat']) {
    await page.getByRole('button', { name: mode }).click()
    await shot(mode.startsWith('Set') ? 'create' : 'join')
    await page.getByRole('button', { name: 'Back to Lounge' }).click()
  }
  for (const mode of ['Leaderboards', 'Buddies', 'Settings']) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    await shot(mode.toLowerCase())
    if (mode === 'Leaderboards') {
      await expect(page.getByText(/Your Global Rank/)).toBeVisible()
      await shot('rank-global')
      await page.getByRole('button', { name: 'Buddies Ranking' }).click()
      await shot('rank-buddies')
    }
    if (mode === 'Buddies') {
      await page.getByLabel('Find registered players').fill('Other')
      await page.getByRole('button', { name: 'Search players' }).click()
      await expect(
        page.getByRole('button', { name: 'Add Buddy' }),
      ).toBeVisible()
      await shot('buddy-search')
    }
    if (mode === 'Leaderboards') await page.getByRole('link', { name: 'Lounge', exact: true }).click()
    else await page.getByRole('button', { name: 'Back to Lounge' }).click()
  }
  await page.goto('/#/profile')
  await expect(
    page.getByRole('region', { name: 'Player career' }),
  ).toBeVisible()
  await shot('profile')
  for (const tab of ['Statistics', 'Game History', 'Buddies']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await shot(`profile-${tab.toLowerCase().replaceAll(' ', '-')}`)
  }
  await profileView(page, '1')
  await shot('profile-edit')
  await page.getByLabel('Display name', { exact: true }).fill('Edited Tester')
  await shot('profile-unsaved')
  await page.getByLabel('Profile picture', { exact: true }).setInputFiles({
    name: 'invalid.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('invalid'),
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await shot('profile-photo-error')
  await profileView(page, '2')
  await shot('account')
  await page.goto('/#/history/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  await expect(page.getByRole('heading', { name: 'Game report' })).toBeVisible()
  await shot('history-report')
  await page
    .getByRole('combobox', { name: 'Report sections' })
    .selectOption('1')
  await shot('history-round')
  await page.goto('/#/player/lc_other')
  await expect(
    page.getByRole('heading', { name: 'Other Player', exact: true }),
  ).toBeVisible()
  await shot('public-profile')
  await page.goto('/auth/callback?flow=recovery')
  await expect(page.getByLabel('New password')).toBeVisible()
  await shot('recovery')
  await page.goto('/#/rules')
  await shot('rules')
  await page.goto('/#/game')
  await page.evaluate((key) => sessionStorage.removeItem(key), SESSION_KEY)
  await page.reload()
  await shot('practice-setup')
  for (const count of [7, 15, 25, 30]) {
    await gamePage(page, auditGame(8, count))
    await shot(`hand-${count}`)
  }
  await page.getByRole('button', { name: 'Game Activity', exact: true }).click()
  await shot('activity')
  await page.getByRole('button', { name: 'View Full History' }).click()
  await shot('activity-history')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Table options' }).click()
  await shot('table-options')
  await page.keyboard.press('Escape')
  await page.locator('.live-opponent').first().click()
  await shot('opponent')
  await page.keyboard.press('Escape')
  const penalty = auditGame()
  penalty.phase = 'penalty'
  penalty.sevens = { initiator: 1, participants: [1], amount: 4 }
  const seven = penalty.drawPile.find((c) => c.rank === '7')!
  penalty.drawPile[penalty.drawPile.indexOf(seven)] = penalty.players[0].hand[0]
  penalty.players[0].hand[0] = seven
  await gamePage(page, penalty)
  await shot('power-seven')
  const low = auditGame()
  low.players[0].hand = low.players[0].hand.slice(0, 1)
  low.players[0].hand[0] = {
    id: low.players[0].hand[0].id,
    rank: 'A',
    suit: 'clubs',
  }
  await gamePage(page, low)
  await shot('least')
  const base = auditGame()
  const dropped = base.players[0].hand.find(
    (c) => c.rank !== '7' && c.rank !== latestGroup(base)[0].rank,
  )!
  const drawing = applyAction(base, {
    type: 'discard',
    playerId: 'p0',
    cardIds: [dropped.id],
  })
  await gamePage(page, drawing)
  await shot('replacement')
  for (const over of [false, true]) {
    const result = auditGame(8)
    result.phase = over ? 'game-over' : 'round-over'
    result.deadline = null
    result.players.forEach((p, i) => {
      p.score = over && i ? 100 : 10 * i
      p.eliminated = over && i > 0
      if (p.eliminated) {
        p.eliminationReason = 'score'
        p.hand = []
      }
    })
    result.result = {
      reason: 'show',
      caller: 'p0',
      successful: true,
      winners: ['p0'],
      scores: result.players.map((p) => ({
        id: p.id,
        name: p.name,
        total: 10,
        penalty: 10,
        score: p.score,
        eliminated: p.eliminated,
      })),
    }
    await gamePage(page, result)
    await shot(over ? 'game-results' : 'round-results')
  }
  const room: RoomView = {
    id: 'ux-audit',
    code: 'ABC234',
    hostId: state.user.player.id,
    settings: { ...DEFAULT_ROOM_SETTINGS, maxPlayers: 8 },
    status: 'waiting',
    revision: 1,
    serverNow: Date.now(),
    game: null,
    members: Array.from({ length: 8 }, (_, i) => ({
      id: i ? `guest:audit-${i}` : state.user.player.id,
      displayName: i ? `Player ${i}` : 'Career Tester',
      avatarUrl: null,
      accountType: i ? 'guest' : 'registered',
      order: i,
      connected: true,
      lastSeen: Date.now(),
      disconnectedAt: null,
      authExpiresAt: Date.now() + 3600000,
      left: false,
    })),
  }
  await page.route('**/api/rooms/ABC234/join', (r) => r.fulfill({ json: room }))
  await page.route('**/api/rooms/ABC234/ticket', (r) =>
    r.fulfill({ json: { ticket: 'mock-audit' } }),
  )
  await page.routeWebSocket('**/api/rooms/ABC234/ws**', (ws) => {
    ws.send(JSON.stringify({ type: 'state', room }))
    ws.onMessage(() =>
      ws.send(JSON.stringify({ type: 'pong', serverNow: Date.now() })),
    )
  })
  await page.goto('/#/room/ABC234')
  await expect(page.locator('.lobby-player')).toHaveCount(8)
  await shot('lobby-8')
  await page.evaluate(() => dispatchEvent(new Event('offline')))
  await shot('disconnected')
  if (phase === 'after') {
    for (const [width, height] of [
      [667, 375],
      [800, 360],
      [844, 390],
      [852, 393],
      [915, 412],
      [932, 430],
      [960, 432],
    ]) {
      await page.setViewportSize({ width, height })
      await expect
        .poll(() =>
          page
            .locator('.app-shell')
            .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
        )
        .toBe(height)
      const outside = await page.locator('main').evaluate((root) =>
        Array.from(root.querySelectorAll('button,a,input,select'))
          .filter((el) => el.checkVisibility() && !el.closest('[hidden]'))
          .flatMap((el) => {
            const r = el.getBoundingClientRect()
            return r.x < -0.5 ||
              r.y < -0.5 ||
              r.right > innerWidth + 0.5 ||
              r.bottom > innerHeight + 0.5
              ? [el.textContent]
              : []
          }),
      )
      expect(outside, `Disconnected lobby at ${width}×${height}`).toEqual([])
    }
  }
  const access = await context.newPage()
  await access.route('**/api/config', (r) =>
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
  await access.route('**/api/session', (r) =>
    r.fulfill({ json: { user: null, room: null } }),
  )
  await access.goto('/')
  await expect(access.getByLabel('Email address')).toBeVisible()
  await shot('sign-in', access)
  for (const mode of ['Sign Up', 'Continue as Guest']) {
    await access.getByRole('button', { name: mode, exact: true }).click()
    await shot(mode === 'Sign Up' ? 'sign-up' : 'guest', access)
  }
  await access.getByRole('button', { name: 'Sign In', exact: true }).click()
  await access.getByRole('button', { name: 'Forgot password?' }).click()
  await shot('reset-request', access)
  await access.goto('/auth/callback?error=access_denied')
  await expect(access.getByRole('alert')).toBeVisible()
  await shot('callback-error', access)
  await access.close()
  const loading = await context.newPage()
  await loading.clock.install()
  await loading.route('**/api/config', () => {})
  await loading.goto('/')
  await expect(loading.getByRole('status')).toBeVisible()
  await shot('loading', loading)
  await loading.clock.fastForward(16000)
  await expect(loading.getByRole('alert')).toBeVisible()
  await shot('startup-error', loading)
  await loading.close()
  writeFileSync(`${folder}/bounds.json`, JSON.stringify(records, null, 2))
})

test('Android landscape representative visual review', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    isMobile: true,
    hasTouch: true,
    viewport: { width: 915, height: 412 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
  })
  const page = await context.newPage()
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mock(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    await page.screenshot({
      path: `${folder}/android-dashboard.jpg`,
      type: 'jpeg',
      quality: 85,
    })
    for (const count of [7, 15, 25, 30]) {
      await gamePage(page, auditGame(8, count))
      await page.screenshot({
        path: `${folder}/android-hand-${count}.jpg`,
        type: 'jpeg',
        quality: 85,
      })
    }
    await page.getByRole('button', { name: 'Table options' }).click()
    await page.screenshot({
      path: `${folder}/android-table-options.jpg`,
      type: 'jpeg',
      quality: 85,
    })
  } finally {
    await context.close()
  }
})
