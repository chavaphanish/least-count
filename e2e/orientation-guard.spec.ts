import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'
import { auditGame } from './ux-fixture'
import { SESSION_KEY } from '../src/lib/session'
const landscape = { width: 844, height: 390 }
const portrait = { width: 390, height: 844 }
test.use({
  viewport: landscape,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
})
test('one guard covers routes and dashboard screens without replacing mounted content', async ({
  page,
}) => {
  await mock(page)
  for (const path of [
    '/',
    '/#/profile',
    '/#/rules',
    '/#/game',
    '/#/player/lc_other',
    '/#/history/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ]) {
    await page.goto(path)
    const main = await page.locator('main').elementHandle()
    await page.setViewportSize(portrait)
    const guard = page.getByRole('dialog', { name: 'Rotate Your Phone' })
    await expect(guard).toBeVisible()
    await expect(guard).toContainText(
      'Least Count is designed to be played in landscape mode.',
    )
    await expect(page.locator('.orientation-content')).toBeHidden()
    await expect(page.locator('.orientation-content')).toHaveAttribute(
      'inert',
      '',
    )
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(
        () =>
          !document
            .querySelector('.orientation-content')!
            .contains(document.activeElement),
      ),
    ).toBe(true)
    await expect(guard).toBeVisible()
    await page.setViewportSize(landscape)
    await expect(guard).toHaveCount(0)
    expect(
      await main!.evaluate((node) => node === document.querySelector('main')),
    ).toBe(true)
  }
  await page.goto('/')
  for (const name of [
    'Create Game Room',
    'Join Game Room',
    'Leaderboards',
    'Buddies',
    'Settings',
  ]) {
    await page.getByRole('button', { name }).click()
    await page.setViewportSize(portrait)
    await expect(
      page.getByRole('dialog', { name: 'Rotate Your Phone' }),
    ).toBeVisible()
    await expect(page.locator('main')).toBeHidden()
    await page.setViewportSize(landscape)
    await page.getByRole('button', { name: 'Back to Lounge' }).click()
  }
})
test('portrait guard covers initial loading and unauthenticated entry', async ({
  page,
}) => {
  await page.setViewportSize(portrait)
  await page.route('**/api/config', () => {})
  await page.goto('/')
  await expect(
    page.getByRole('dialog', { name: 'Rotate Your Phone' }),
  ).toBeVisible()
  await expect(page.locator('main')).toBeHidden()
  await page.setViewportSize(landscape)
  await expect(page.getByText('Connecting to game services…')).toBeVisible()
  await page.unroute('**/api/config')
  await page.route('**/api/config', (r) =>
    r.fulfill({ json: { service: 'least-count', supabase: null } }),
  )
  await page.route('**/api/session', (r) =>
    r.fulfill({ json: { user: null, room: null } }),
  )
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Continue as Guest', exact: true }),
  ).toBeVisible()
  await page.setViewportSize(portrait)
  await expect(
    page.getByRole('dialog', { name: 'Rotate Your Phone' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Continue as Guest', exact: true }),
  ).toHaveCount(0)
})
test('portrait hides an already-open modal and preserves selection, state and deadline', async ({
  page,
}) => {
  const game = auditGame()
  await page.clock.install({ time: game.deadline! - 90_000 })
  await page.clock.pauseAt(game.deadline! - 59_999)
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
    { key: SESSION_KEY, game },
  )
  await page.reload()
  const card = page.locator('.hand-card').first()
  await card.tap()
  const state = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    SESSION_KEY,
  )
  await page.getByRole('button', { name: 'Table options' }).click()
  await page.setViewportSize(portrait)
  const guard = page.getByRole('dialog', { name: 'Rotate Your Phone' })
  await expect(guard).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Table options' })).toHaveCount(
    0,
  )
  await card.evaluate((el) => (el as HTMLElement).focus())
  expect(await card.evaluate((el) => document.activeElement === el)).toBe(false)
  await page.keyboard.press('Escape')
  await expect(guard).toBeVisible()
  await page.setViewportSize(landscape)
  await expect(
    page.getByRole('dialog', { name: 'Table options' }),
  ).toBeVisible()
  await page
    .getByRole('dialog', { name: 'Table options' })
    .getByRole('button', { name: 'Close' })
    .click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY),
  ).toBe(state)
})
