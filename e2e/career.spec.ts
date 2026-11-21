import { deflateSync, crc32 } from 'node:zlib'
import { expect, test } from '@playwright/test'
import { mock, png } from './career-fixture'
async function editingProfile(page: import('@playwright/test').Page) {
  const state = await mock(page)
  const profile = { username: 'cardmaster99', firstName: 'Career', lastName: 'Tester', needsCompletion: false }
  Object.assign(state.user, { profile }); Object.assign(state.user.player, profile)
  await page.route('**/api/username?**', route => route.fulfill({ json: { available: true } }))
  await page.route('**/api/profile/identity', route => route.fulfill({ json: { user: state.user } }))
  return state
}
for (const width of [320, 1440])
  test(`career profile, history, and ranking work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const state = await mock(page)
    await page.goto('/#/leaderboards')
    await expect(
      page.getByRole('heading', { name: 'Leaderboards' }),
    ).toBeVisible()
    await expect(page.getByText(/Your Global Rank: #124/)).toBeVisible()
    await page
      .getByRole('button', { name: 'Buddies Ranking', exact: true })
      .click()
    await expect(page.getByText(/Your Buddies Rank/)).toBeVisible()
    await page.goto('/#/profile')
    const profile = page.getByRole('region', { name: 'My Profile', exact: true })
    await expect(profile.getByRole('tab')).toHaveText(['Overview', 'Stats'])
    await expect(page.getByRole('banner').getByRole('progressbar')).toHaveAttribute('value', '250')
    await expect(profile).not.toContainText('XP')
    await expect(page.getByText('owner-private@example.test', { exact: true })).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/least-count-profile-overview-${width}.png`,
      fullPage: true,
    })
    await profile.getByRole('tab', { name: 'Stats', exact: true }).click()
    await expect(profile.getByText('Games played', { exact: true })).toBeVisible()
    // Private game reports remain addressable; My Profile no longer lists history.
    await page.goto(`/#/history/${state.game.id}`)
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
    page.getByRole('heading', { name: /^Other Player @lc_other$/ }),
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
test('incoming friend requests can be accepted from Your Circle', async ({ page }) => {
  const state = await mock(page)
  state.setRelationship('incoming')
  await page.goto('/#/buddies')
  const buddies = page.getByRole('region', { name: 'Buddies', exact: true })
  await buddies.getByRole('button', { name: 'Friend Requests', exact: true }).click()
  await buddies.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(buddies.getByRole('status')).toHaveText('Friend request accepted.')
  await buddies.getByRole('button', { name: 'All Friends', exact: true }).click()
  await expect(buddies.getByRole('link', { name: /Other Player/ })).toBeVisible()
})
test('photo preview, failed upload retry, replacement and removal work immediately', async ({
  page,
}) => {
  const state = await editingProfile(page)
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
  await page.goto('/#/settings/profile')
  await page
    .getByLabel('Profile picture', { exact: true })
    .setInputFiles({ name: 'phone.png', mimeType: 'image/png', buffer: png })
  await expect(
    page.locator('.compact-profile-editor .profile-avatar img'),
  ).toHaveAttribute('src', /^blob:/)
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Upload temporarily unavailable',
  )
  await expect(page.locator('.header-profile img')).toHaveAttribute(
    'src',
    '/test-avatar-old.png',
  )
  fail = false
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.locator('.header-profile img')).toHaveAttribute(
    'src',
    '/test-avatar-v2.png',
  )
  await page
    .getByRole('button', { name: 'Remove picture', exact: true })
    .click()
  await expect(page.locator('.header-profile img')).toHaveCount(0)
  await expect(
    page.locator('.header-profile .profile-avatar'),
  ).toHaveText('CT')
})

test('phone photos above the former 2 MB limit are optimized, while files above 5 MB are rejected', async ({
  page,
}) => {
  await editingProfile(page)
  await page.goto('/#/settings/profile')
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
    page.locator('.compact-profile-editor .profile-avatar img'),
  ).toHaveAttribute('src', /^blob:/)
  await expect(
    page.getByRole('button', { name: 'Save Changes', exact: true }),
  ).toBeEnabled()
  await page.getByLabel('Profile picture', { exact: true }).setInputFiles({
    name: 'too-large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })
  await expect(page.getByRole('alert')).toContainText('5 MB')
})
