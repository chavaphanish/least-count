import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mock } from './career-fixture'
import { auditGame } from './ux-fixture'
import { SESSION_KEY } from '../src/lib/session'
import { formatGameEvent } from '../src/game/events'
const sizes = [
  [667, 375],
  [800, 360],
  [844, 390],
  [852, 393],
  [915, 412],
  [932, 430],
  [960, 432],
]
test.use({
  viewport: { width: 667, height: 375 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
})
async function size(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await expect
    .poll(() =>
      page
        .locator('.app-shell')
        .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
    )
    .toBe(width)
}
async function fits(page: Page) {
  expect(
    await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'main button,main input,main select,dialog[open] button,dialog[open] select',
        ),
      )
        .filter((el) => el.checkVisibility() && !el.closest('[hidden]'))
        .flatMap((el) => {
          const r = el.getBoundingClientRect()
          return r.x < 0 ||
            r.y < 0 ||
            r.right > innerWidth + 0.5 ||
            r.bottom > innerHeight + 0.5
            ? [el.textContent]
            : []
        }),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]),
  ).toEqual([page.viewportSize()!.width, page.viewportSize()!.height])
}
test('profile editing and account details remain reachable when careers are disabled', async ({
  page,
}) => {
  await mock(page)
  await page.route('**/api/career**', (r) =>
    r.fulfill({
      status: 503,
      json: { error: 'Player careers are not enabled yet.' },
    }),
  )
  await page.goto('/#/profile')
  await expect(page.getByRole('status')).toContainText(
    'Player careers are not enabled yet.',
  )
  await page.screenshot({
    path: 'docs/mobile-ux/after/career-disabled.jpg',
    type: 'jpeg',
    quality: 85,
  })
  for (const [width, height] of sizes) {
    await size(page, width, height)
    await page
      .getByRole('button', { name: 'Edit Profile', exact: true })
      .click()
    await expect(page.getByLabel('Display name', { exact: true })).toBeVisible()
    await fits(page)
    await page
      .getByRole('combobox', { name: 'Profile views' })
      .selectOption('2')
    await expect(page.getByText('owner-private@example.test')).toBeVisible()
    await fits(page)
    await page.getByRole('button', { name: 'Back to player career' }).click()
  }
})
test('long eight-player public activities have complete paginated details without scrolling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const game = auditGame(8)
  game.settings = { timedGame: false, eliminationThreshold: 100 }
  game.deadline = null
  game.events = Array.from({ length: 5 }, (_, i) => ({
    type: 'ROUND_COMPLETED',
    id: `long-${i}`,
    roundNumber: i + 1,
    sequenceNumber: i + 1,
    timestamp: Date.now(),
    reason: 'show',
    scores: game.players.map((p, index) => ({
      id: p.id,
      name: `Player ${index} with a long name`,
      total: 77,
      penalty: 77,
      score: 9999,
    })),
  }))
  game.eventSequence = 5
  const expected = formatGameEvent(game.events[4])
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
    { key: SESSION_KEY, game },
  )
  await page.reload()
  await page.getByRole('button', { name: 'Game Activity', exact: true }).click()
  await expect(page.locator('.recent-history li:visible')).toHaveCount(5)
  await fits(page)
  await page.locator('.activity-entry').first().click()
  const select = page.getByRole('combobox', {
    name: 'Activity detail sections',
  })
  const count = await select.locator('option').count()
  expect(count).toBeGreaterThan(1)
  for (const [width, height] of sizes) {
    await size(page, width, height)
    const text: string[] = []
    for (let index = 0; index < count; index++) {
      await select.selectOption(String(index))
      text.push((await page.locator('.activity-detail:visible').textContent())!)
      await fits(page)
      expect(
        await page
          .locator('.table-overlay-body')
          .last()
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true)
    }
    expect(text.join(' ')).toBe(expected)
  }
  await size(page, 667, 375)
  await select.selectOption('0')
  await page.screenshot({
    path: 'docs/mobile-ux/after/activity-detail.jpg',
    type: 'jpeg',
    quality: 85,
  })
  await page.getByRole('button', { name: '← Back to activity' }).click()
  await expect(page.locator('.recent-history li:visible')).toHaveCount(5)
})
