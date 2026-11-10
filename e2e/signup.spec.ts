import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mock } from './career-fixture'
const mobile = { width: 667, height: 375 }
test.use({
  viewport: mobile,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  hasTouch: true,
  isMobile: true,
})
async function setup(page: Page) {
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        service: 'least-count',
        supabase: {
          url: 'https://mock-project.supabase.co',
          publishableKey: 'sb_publishable_test',
        },
      },
    }),
  )
  await page.route('**/api/session', (r) =>
    r.fulfill({ json: { user: null, room: null } }),
  )
  const checks: string[] = []
  await page.route('**/api/username?**', (r) => {
    const name = new URL(r.request().url()).searchParams.get('username')!
    checks.push(name)
    return r.fulfill({
      json: { username: name, available: name !== 'alreadytaken123' },
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click()
  return checks
}
async function identity(page: Page) {
  await page.getByLabel('Username', { exact: true }).fill('CardMaster99')
  await page.getByLabel('First Name', { exact: true }).fill('  José María ')
  await page.getByLabel('Last Name', { exact: true }).fill(' O’Neill ')
  await expect(page.getByRole('status')).toContainText('Username available.')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
}
async function passwordStep(page: Page) {
  await identity(page)
  await page.getByLabel('Email address').fill(' Person+tag@EXAMPLE.COM ')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
}
async function keyboard(page: Page, on: boolean) {
  await page.evaluate((on) => {
    if (on)
      Object.defineProperty(visualViewport!, 'height', {
        configurable: true,
        get: () => 170,
      })
    else delete (visualViewport as unknown as { height?: number }).height
    visualViewport!.dispatchEvent(new Event('resize'))
  }, on)
  await expect(page.locator('[data-keyboard=true]')).toHaveCount(on ? 1 : 0)
}
async function bounds(page: Page) {
  const bad = await page
    .locator('.signup-wizard,.identity-editor')
    .evaluateAll((roots) =>
      roots.flatMap((root) =>
        Array.from(
          root.querySelectorAll('input,button,[role=status],[role=alert]'),
        )
          .filter((el) => el.checkVisibility() && !el.closest('[hidden]'))
          .flatMap((el) => {
            const r = el.getBoundingClientRect()
            return r.top < 0 ||
              r.left < 0 ||
              r.right > (visualViewport?.width ?? innerWidth) + 0.5 ||
              r.bottom > (visualViewport?.height ?? innerHeight) + 0.5
              ? [el.getAttribute('aria-label') ?? el.textContent]
              : []
          }),
      ),
    )
  expect(bad).toEqual([])
}
test('identity validates before Next, debounces checks, and preserves values across three steps', async ({
  page,
}) => {
  const checks = await setup(page),
    next = page.getByRole('button', { name: 'Next', exact: true })
  await expect(next).toBeDisabled()
  await page.getByLabel('Username', { exact: true }).fill('short')
  await expect(page.getByRole('status')).toContainText('too short')
  expect(checks).toEqual([])
  await page.getByLabel('Username', { exact: true }).fill('player_name')
  await expect(page.getByRole('status')).toContainText(
    'Only letters and numbers',
  )
  expect(checks).toEqual([])
  await page.getByLabel('Username', { exact: true }).fill('alreadytaken123')
  await expect(page.getByRole('status')).toContainText('already taken')
  await expect(next).toBeDisabled()
  await identity(page)
  expect(checks).toEqual(['alreadytaken123', 'cardmaster99'])
  await expect(page.getByText('Step 2 of 3 · Email Address')).toBeVisible()
  await page.getByLabel('Email address').fill('invalid')
  await expect(next).toBeDisabled()
  await page.getByLabel('Email address').fill('new@example.test')
  await next.click()
  await expect(page.getByText('Step 3 of 3 · Password')).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByLabel('Email address')).toHaveValue('new@example.test')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(
    'CardMaster99',
  )
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue(
    '  José María ',
  )
  await bounds(page)
})
test('password confirmation and visibility are independent; registration normalizes identity and prevents duplicate submissions', async ({
  page,
}) => {
  await setup(page)
  await passwordStep(page)
  const password = page.getByLabel('Password', { exact: true }),
    confirm = page.getByLabel('Confirm Password', { exact: true }),
    create = page.getByRole('button', { name: 'Create account', exact: true })
  await password.fill('short')
  await expect(create).toBeDisabled()
  await expect(
    page.getByText('Use at least 8 characters for your password.'),
  ).toBeVisible()
  await password.fill('        ')
  await confirm.fill('        ')
  await expect(create).toBeDisabled()
  await password.fill(' a long passphrase ')
  await confirm.fill('different')
  await expect(page.getByText('Passwords do not match.')).toBeVisible()
  await expect(create).toBeDisabled()
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(confirm).toHaveAttribute('type', 'password')
  await page
    .getByRole('button', { name: 'Show confirm password', exact: true })
    .click()
  await expect(confirm).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue(' a long passphrase ')
  await confirm.fill(' a long passphrase ')
  let calls = 0
  await page.route(
    'https://mock-project.supabase.co/auth/v1/signup**',
    async (r) => {
      calls++
      expect(r.request().postDataJSON()).toMatchObject({
        email: 'person+tag@example.com',
        password: ' a long passphrase ',
        data: {
          username: 'cardmaster99',
          first_name: 'José María',
          last_name: 'O’Neill',
        },
      })
      await new Promise((resolve) => setTimeout(resolve, 250))
      await r.fulfill({
        json: {
          user: {
            id: 'new-user',
            email: 'person+tag@example.com',
            identities: [{}],
          },
          session: null,
        },
      })
    },
  )
  await create.click()
  await page.locator('.signup-form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await expect(page.getByRole('status')).toContainText('verification link')
  expect(calls).toBe(1)
  await expect(create).toBeDisabled()
  await bounds(page)
})
test('provider rejects weak passwords and existing-email attempts without a public email lookup', async ({
  page,
}) => {
  await setup(page)
  await passwordStep(page)
  await page.getByLabel('Password', { exact: true }).fill('valid password')
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('valid password')
  let emailLookup = false
  page.on('request', (r) => {
    if (/availability.*email|email.*availability/.test(r.url()))
      emailLookup = true
  })
  let weak = true
  await page.route('https://mock-project.supabase.co/auth/v1/signup**', (r) =>
    r.fulfill({
      status: 422,
      json: {
        code: weak ? 'weak_password' : 'user_already_exists',
        msg: weak
          ? 'Password does not meet provider policy.'
          : 'User already registered',
      },
    }),
  )
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('provider policy')
  weak = false
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('use Sign In or reset')
  expect(emailLookup).toBe(false)
})
test('final submission rechecks username and returns to identity if another account claimed it', async ({
  page,
}) => {
  await setup(page)
  await passwordStep(page)
  await page.getByLabel('Password', { exact: true }).fill('valid password')
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('valid password')
  await page.route('**/api/username?**', (r) =>
    r.fulfill({ json: { available: false } }),
  )
  let providerCalls = 0
  page.on('request', (r) => {
    if (r.url().includes('/auth/v1/signup')) providerCalls++
  })
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(page.getByText('Step 1 of 3 · Player Identity')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('already taken')
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeDisabled()
  expect(providerCalls).toBe(0)
})
test('signup remains usable at keyboard height with field values retained', async ({
  page,
}) => {
  await setup(page)
  await page.getByLabel('Username', { exact: true }).fill('KeyboardUser99')
  await page.getByLabel('Username', { exact: true }).focus()
  await keyboard(page, true)
  await bounds(page)
  await page.getByRole('button', { name: 'Next field' }).click()
  await page.getByLabel('First Name', { exact: true }).fill('Élodie')
  await bounds(page)
  await page.getByRole('button', { name: 'Next field' }).click()
  await page.getByLabel('Last Name', { exact: true }).fill('李')
  await expect(page.getByRole('status')).toContainText('available')
  await bounds(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Email address').fill('keyboard@example.test')
  await bounds(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Password', { exact: true }).fill('valid password')
  await bounds(page)
  await page.getByRole('button', { name: 'Next field' }).click()
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('valid password')
  await bounds(page)
  await keyboard(page, false)
  await bounds(page)
})
test('legacy profile completion is optional for login and public names save through owner endpoint', async ({
  page,
}) => {
  const fixture = await mock(page)
  Object.assign(fixture.user, {
    profile: {
      username: 'legacyuser99',
      firstName: '',
      lastName: '',
      needsCompletion: true,
    },
  })
  fixture.user.player.displayName = '@legacyuser99'
  await page.route('**/api/username?**', (r) =>
    r.fulfill({ json: { available: true } }),
  )
  await page.route('**/api/profile/identity', (r) => {
    expect(r.request().postDataJSON()).toEqual({
      username: 'legacyuser99',
      firstName: 'José',
      lastName: '李',
    })
    Object.assign(fixture.user, {
      profile: {
        username: 'legacyuser99',
        firstName: 'José',
        lastName: '李',
        needsCompletion: false,
      },
    })
    return r.fulfill({ json: { user: fixture.user } })
  })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Welcome, @legacyuser99.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Update profile →' }).click()
  await expect(
    page.getByRole('heading', { name: 'Complete your profile' }),
  ).toBeVisible()
  await page.getByLabel('First Name', { exact: true }).fill(' José ')
  await keyboard(page, true)
  await bounds(page)
  await page.getByRole('button', { name: 'Next field' }).click()
  await page.getByLabel('Last Name', { exact: true }).fill('李')
  await bounds(page)
  await expect(
    page.getByRole('button', { name: 'Save identity' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Save identity' }).click()
  await expect(
    page.getByText('Your public name and username are saved.'),
  ).toBeVisible()
  await bounds(page)
  await keyboard(page, false)
  await bounds(page)
  await page.getByRole('link', { name: 'Lounge', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Update profile →' }),
  ).toHaveCount(0)
})

for (const android of [false, true])
  test(`${android ? 'Android' : 'desktop'} signup retains all three steps`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: android
        ? { width: 915, height: 412 }
        : { width: 1280, height: 800 },
      ...(android
        ? {
            isMobile: true,
            hasTouch: true,
            userAgent:
              'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
          }
        : {}),
    })
    try {
      const page = await context.newPage()
      await setup(page)
      await passwordStep(page)
      await expect(page.getByText('Step 3 of 3 · Password')).toBeVisible()
      await bounds(page)
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page.getByLabel('Email address')).toHaveValue(
        'Person+tag@EXAMPLE.COM',
      )
      await bounds(page)
    } finally {
      await context.close()
    }
  })
