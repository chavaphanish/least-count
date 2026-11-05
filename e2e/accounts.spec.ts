import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const profile = {
  player: {
    id: 'user:profile-test',
    displayName: 'Profile Tester',
    avatarUrl: null as string | null,
    accountType: 'registered',
  },
  email: 'private@example.test',
  createdAt: '2026-01-01T00:00:00Z',
  lastActiveAt: '2026-11-05T00:00:00Z',
}
async function mockProvider(page: Page) {
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: {
        supabase: {
          url: 'https://mock-project.supabase.co',
          publishableKey: 'sb_publishable_test',
        },
        service: 'least-count',
      },
    }),
  )
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: null, room: null } }),
  )
}

test('startup failure has retry and retry performs real initialization', async ({
  page,
}) => {
  let offline = true
  await page.route('**/api/config', (route) =>
    route.fulfill(
      offline
        ? { status: 503, json: { error: 'Service temporarily unavailable' } }
        : { json: { supabase: null, service: 'least-count' } },
    ),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText(
    'Service temporarily unavailable',
  )
  offline = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(
    page.getByRole('button', { name: 'Continue as Guest', exact: true }),
  ).toBeVisible()
})

test('a stalled initialization times out instead of leaving a permanent spinner', async ({
  page,
}) => {
  await page.clock.install()
  await page.route('**/api/config', () => {})
  await page.goto('/')
  await expect(page.getByText('Connecting to game services…')).toBeVisible()
  await page.clock.fastForward(16_000)
  await expect(page.getByRole('alert')).toContainText(
    /timed out|could not be reached/,
  )
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
})

test('email signup requests verification and recovery requests a real provider reset', async ({
  page,
}) => {
  await mockProvider(page)
  let signup: Record<string, unknown> = {}
  await page.route(
    'https://mock-project.supabase.co/auth/v1/signup**',
    async (route) => {
      signup = route.request().postDataJSON()
      await route.fulfill({
        json: {
          user: { id: 'new-user', email: 'new@example.test', identities: [] },
          session: null,
        },
      })
    },
  )
  let reset = false
  await page.route(
    'https://mock-project.supabase.co/auth/v1/recover**',
    async (route) => {
      reset = true
      await route.fulfill({ json: {} })
    },
  )
  await page.goto('/')
  await expect(page.getByRole('button', { name: /google/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click()
  await expect(page.getByRole('button', { name: /google/i })).toHaveCount(0)
  await page.getByLabel('Display name', { exact: true }).fill('New Player')
  await page.getByLabel('Email address').fill('new@example.test')
  await page.getByLabel('Password', { exact: true }).fill('test-only-password')
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('verification link')
  expect(signup.email).toBe('new@example.test')
  expect(signup.data).toEqual({ display_name: 'New Player' })
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText(
    'reset link has been requested',
  )
  expect(reset).toBe(true)
})

test('failed email callback keeps its invitation and allows another sign-in attempt', async ({
  page,
}) => {
  await mockProvider(page)
  await page.addInitScript(() =>
    sessionStorage.setItem('lc:invitation', 'ABC234'),
  )
  await page.goto('/auth/callback?error=access_denied')
  await expect(page.getByRole('alert')).toContainText('cancelled')
  await expect(
    page.getByText('Your invitation to room', { exact: false }),
  ).toContainText('ABC234')
  await expect(page.getByLabel('Email address')).toBeVisible()
})

test('registered profile restores, saves name, rejects invalid image, and removes avatar', async ({
  page,
}) => {
  const current = structuredClone(profile)
  current.player.avatarUrl = 'https://images.example.test/missing.png'
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { supabase: null, service: 'least-count' } }),
  )
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: current, room: null } }),
  )
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({ status: 404 }),
  )
  await page.route('**/api/profile', async (route) => {
    current.player.displayName = route.request().postDataJSON().displayName
    await route.fulfill({ json: current })
  })
  await page.route('**/api/profile/avatar', async (route) => {
    expect(route.request().method()).toBe('DELETE')
    current.player.avatarUrl = null
    await route.fulfill({ json: current })
  })
  await page.goto('/#/profile')
  await expect(
    page.getByText('private@example.test', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Display name', { exact: true }).fill('Renamed Player')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('profile is saved')
  await page.getByLabel('Profile picture', { exact: true }).setInputFiles({
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  })
  await expect(page.getByRole('alert')).toContainText(/image|PNG|file/)
  await page
    .getByRole('button', { name: 'Remove picture', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('picture removed')
  await page.reload()
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
    'Renamed Player',
  )
})
