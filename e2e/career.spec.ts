import { deflateSync, crc32 } from 'node:zlib'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const uid = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222',
  gid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGMw6on6D8IMMAYARuQIXZeBPNsAAAAASUVORK5CYII=',
  'base64',
)
async function mock(page: Page) {
  const user = {
    player: {
      id: `user:${uid}`,
      displayName: 'Career Tester',
      avatarUrl: null as string | null,
      accountType: 'registered',
    },
    email: 'owner-private@example.test',
    createdAt: '2026-01-01T00:00:00Z',
    lastActiveAt: '2026-11-06T00:00:00Z',
  }
  const me = {
    id: uid,
    username: 'lc_owner',
    displayName: user.player.displayName,
    avatarUrl: null as string | null,
    createdAt: user.createdAt,
    xp: 1250,
    gamesWon: 18,
    gamesPlayed: 25,
    rank: 124,
    levelBase: 50,
  }
  const friend = {
    ...me,
    id: other,
    username: 'lc_other',
    displayName: 'Other Player',
    xp: 1500,
    rank: 1,
  }
  let relationship = 'none'
  const game = {
    id: gid,
    startedAt: 1000,
    completedAt: 120000,
    status: 'completed',
    settings: { timedGame: true, eliminationThreshold: 100 },
    xp: 150,
    players: [
      {
        id: `user:${uid}`,
        name: 'Career Tester',
        score: 0,
        rank: 1,
        outcome: 'won',
        stats: { playingMs: 119000, completedTurns: 3, decisionMs: 9000 },
      },
      {
        id: `user:${other}`,
        name: 'Other Player',
        score: 100,
        rank: 2,
        outcome: 'lost',
        stats: {},
      },
    ],
    rounds: [
      {
        round: 1,
        at: 120000,
        reason: 'show',
        caller: `user:${uid}`,
        successful: true,
        scores: [
          {
            id: `user:${uid}`,
            name: 'Career Tester',
            total: 0,
            penalty: 0,
            score: 0,
          },
          {
            id: `user:${other}`,
            name: 'Other Player',
            total: 10,
            penalty: 10,
            score: 100,
          },
        ],
      },
    ],
  }
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { supabase: null, service: 'least-count' } }),
  )
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user, room: null } }),
  )
  await page.route('**/api/profile', (route) => {
    user.player.displayName = route.request().postDataJSON().displayName
    return route.fulfill({ json: { user } })
  })
  await page.route('**/test-avatar-*.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  )
  await page.route('**/api/career**', async (route) => {
    const op = new URL(route.request().url()).searchParams.get('op')
    const data = {
      profile: {
        ...me,
        avatarUrl: user.player.avatarUrl,
        displayName: user.player.displayName,
      },
      own: true,
      relationship: 'none',
      statistics: {
        gamesStarted: 26,
        gamesPlayed: 25,
        gamesWon: 18,
        roundsPlayed: 100,
        roundsCompleted: 98,
        declarations: 25,
        successfulDeclarations: 18,
        declaredTotal: 75,
        completedTurns: 10,
        decisionMs: 84000,
        playingMs: 52320000,
        currentWinStreak: 3,
      },
      config: { round: 10, game: 25, victory: 75, levelBase: 50 },
      games: [game],
      opponents: [
        {
          ...friend,
          gamesTogether: 12,
          wins: 8,
          losses: 3,
          lastGame: '2026-11-06',
          relationship,
        },
      ],
    }
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON()
      expect(input.id).toBe(other)
      relationship =
        input.action === 'request'
          ? 'outgoing'
          : input.action === 'accept'
            ? 'accepted'
            : input.action === 'block'
              ? 'blocked'
              : 'none'
      return route.fulfill({ json: { relationship } })
    }
    if (op === 'leaderboard')
      return route.fulfill({ json: { players: [friend], me, more: false } })
    if (op === 'public')
      return route.fulfill({
        json: {
          profile: friend,
          own: false,
          relationship,
          config: data.config,
        },
      })
    if (op === 'search')
      return route.fulfill({ json: [{ ...friend, relationship }] })
    if (op === 'buddies')
      return route.fulfill({
        json: {
          players:
            relationship === 'accepted' ||
            relationship === 'incoming' ||
            relationship === 'outgoing'
              ? [{ ...friend, relationship }]
              : [],
          blocked: relationship === 'blocked' ? [friend] : [],
        },
      })
    if (op === 'game') return route.fulfill({ json: game })
    return route.fulfill({ json: data })
  })
  return {
    user,
    me,
    friend,
    game,
    setRelationship: (value: string) => {
      relationship = value
    },
  }
}
for (const width of [320, 1440])
  test(`career profile, history, and ranking work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await mock(page)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'XP Ranking' }),
    ).toBeVisible()
    await expect(page.getByText(/Your Global Rank: #124/)).toBeVisible()
    await page
      .getByRole('button', { name: 'Buddies Ranking', exact: true })
      .click()
    await expect(page.getByText(/Your Buddies Rank/)).toBeVisible()
    await page.goto('/#/profile')
    await expect(
      page.getByRole('region', { name: 'Player career' }),
    ).toContainText('LEVEL 5')
    await expect(page.locator('#career-xp')).toHaveAttribute('value', '250')
    await expect(
      page.getByText('owner-private@example.test', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/least-count-profile-overview-${width}.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Statistics', exact: true }).click()
    await expect(
      page.getByText('Total round penalty points', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Game History', exact: true })
      .click()
    await page.locator('.history-list a').first().click()
    await expect(
      page.getByRole('heading', { name: 'Game report' }),
    ).toBeVisible()
    await expect(page.getByText(/Historical private hands/)).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/least-count-career-${width}.png`,
      fullPage: true,
    })
  })
test('public profiles hide private tabs and support buddy requests', async ({
  page,
}) => {
  await mock(page)
  await page.goto('/#/player/lc_other')
  await expect(
    page.getByRole('heading', { name: 'Other Player', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Game History', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText('owner-private@example.test')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add Buddy', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cancel request', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Cancel request', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Add Buddy', exact: true }),
  ).toBeVisible()
})
test('incoming buddy requests can be accepted, removed, blocked and unblocked', async ({
  page,
}) => {
  const state = await mock(page)
  state.setRelationship('incoming')
  await page.goto('/#/profile')
  await page.getByRole('button', { name: 'Buddies', exact: true }).click()
  const buddies = page.getByRole('region', { name: 'Buddies', exact: true })
  await buddies.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(
    buddies.getByRole('button', { name: 'Remove Buddy', exact: true }),
  ).toBeVisible()
  await buddies
    .getByRole('button', { name: 'Block player', exact: true })
    .click()
  await expect(
    buddies.getByRole('button', { name: 'Unblock', exact: true }),
  ).toBeVisible()
  await buddies.getByRole('button', { name: 'Unblock', exact: true }).click()
  await expect(
    buddies.getByRole('button', { name: 'Unblock', exact: true }),
  ).toHaveCount(0)
})
test('photo preview, failed upload retry, replacement and removal work immediately', async ({
  page,
}) => {
  const state = await mock(page)
  state.user.player.avatarUrl = '/test-avatar-old.png'
  let fail = true,
    uploads = 0
  await page.route('**/api/profile/avatar', async (route) => {
    if (route.request().method() === 'DELETE') {
      state.user.player.avatarUrl = null
      return route.fulfill({ json: { user: state.user } })
    }
    uploads++
    expect(route.request().headers()['content-type']).toBe('image/webp')
    expect(route.request().postDataBuffer()!.length).toBeLessThan(100000)
    if (fail)
      return route.fulfill({
        status: 503,
        json: { error: 'Upload temporarily unavailable' },
      })
    state.user.player.avatarUrl = `/test-avatar-v${uploads}.png`
    return route.fulfill({ json: { user: state.user } })
  })
  await page.goto('/#/profile')
  await page
    .getByLabel('Profile picture', { exact: true })
    .setInputFiles({ name: 'phone.png', mimeType: 'image/png', buffer: png })
  await expect(
    page.locator('.profile-editor .profile-avatar img'),
  ).toHaveAttribute('src', /^blob:/)
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Upload temporarily unavailable',
  )
  await expect(page.locator('.career-profile-header img')).toHaveAttribute(
    'src',
    '/test-avatar-old.png',
  )
  fail = false
  await page.getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect(page.locator('.career-profile-header img')).toHaveAttribute(
    'src',
    '/test-avatar-v2.png',
  )
  await page
    .getByRole('button', { name: 'Remove picture', exact: true })
    .click()
  await expect(page.locator('.career-profile-header img')).toHaveCount(0)
  await expect(
    page.locator('.career-profile-header .profile-avatar'),
  ).toHaveText('CA')
})

test('phone photos above the former 2 MB limit are optimized, while files above 5 MB are rejected', async ({
  page,
}) => {
  await mock(page)
  await page.goto('/#/profile')
  const width = 768,
    height = 1024,
    raw = Buffer.alloc(height * (width * 4 + 1))
  let seed = 13
  for (let row = 0; row < height; row++)
    for (let x = 1; x <= width * 4; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      raw[row * (width * 4 + 1) + x] = seed >>> 24
    }
  const chunk = (type: string, bytes: Buffer) => {
    const tag = Buffer.from(type),
      size = Buffer.alloc(4),
      crc = Buffer.alloc(4)
    size.writeUInt32BE(bytes.length)
    crc.writeUInt32BE(crc32(Buffer.concat([tag, bytes])))
    return Buffer.concat([size, tag, bytes, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const photo = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  expect(photo.length).toBeGreaterThan(2 * 1024 * 1024)
  expect(photo.length).toBeLessThan(5 * 1024 * 1024)
  await page.getByLabel('Profile picture', { exact: true }).setInputFiles({
    name: 'large-phone.png',
    mimeType: 'image/png',
    buffer: photo,
  })
  await expect(
    page.locator('.profile-editor .profile-avatar img'),
  ).toHaveAttribute('src', /^blob:/)
  await expect(
    page.getByRole('button', { name: 'Save profile', exact: true }),
  ).toBeEnabled()
  await page.getByLabel('Profile picture', { exact: true }).setInputFiles({
    name: 'too-large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })
  await expect(page.getByRole('alert')).toContainText('5 MB')
})
