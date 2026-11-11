import {expect,test} from '@playwright/test'
import type {Page} from '@playwright/test'
import {mock} from './career-fixture'
test.use({viewport:{width:667,height:375},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',hasTouch:true,isMobile:true})
async function setup(page:Page){
 await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:{url:'https://mock-project.supabase.co',publishableKey:'sb_publishable_test'}}}))
 await page.route('**/api/session',r=>r.fulfill({json:{user:null,room:null}}))
 await page.route('**/api/auth/availability',r=>r.fulfill({json:{usernameAvailable:true,emailAvailable:true}}))
 await page.goto('/');await page.getByRole('button',{name:'Sign Up',exact:true}).click()
}
async function personal(page:Page){await page.getByLabel('First Name',{exact:true}).fill(' John ');await page.getByLabel('Last Name',{exact:true}).fill(' Smith ');await page.getByRole('button',{name:'Next',exact:true}).click()}
async function passwordStep(page:Page){await personal(page);await page.getByLabel('Username',{exact:true}).fill('CardMaster99');await page.getByLabel('Email address',{exact:true}).fill(' Person+tag@EXAMPLE.COM ');await page.getByRole('button',{name:'Next',exact:true}).click()}
const popup=(page:Page)=>page.getByRole('alertdialog',{name:'Check your details'})
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
test('each signup step contains only its own fields, with empty placeholders and preserved earlier values',async({page})=>{
 await setup(page)
 await expect(page.locator('.access-card > h2')).toHaveCount(0)
 await expect(page.locator('.signup-form input')).toHaveCount(2)
 await expect(page.getByPlaceholder('First name',{exact:true})).toHaveValue('');await expect(page.getByPlaceholder('Last name',{exact:true})).toHaveValue('')
 await personal(page)
 await expect(page.locator('.signup-form input')).toHaveCount(2)
 await expect(page.getByPlaceholder('username',{exact:true})).toHaveValue('');await expect(page.getByPlaceholder('yourmail@provider.com')).toHaveValue('')
 await page.getByLabel('Username',{exact:true}).fill('CardMaster99');await page.getByLabel('Email address',{exact:true}).fill('Person@example.test');await page.getByRole('button',{name:'Next',exact:true}).click()
 await expect(page.locator('.signup-form input')).toHaveCount(2);await expect(page.getByPlaceholder('Password',{exact:true})).toHaveValue('')
 await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByLabel('Username',{exact:true})).toHaveValue('cardmaster99')
 await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByLabel('First Name',{exact:true})).toHaveValue('John');await expect(page.getByLabel('Last Name',{exact:true})).toHaveValue('Smith')
 await bounds(page)
})
test('personal name failures show one accessible popup and clear only the personal step on OK or Escape',async({page})=>{
 await setup(page)
 for(const firstName of ['John123','Mary-Jane',"O'Connor",'John Smith','']){
  await page.getByLabel('First Name',{exact:true}).fill(firstName);await page.getByRole('button',{name:'Next',exact:true}).click()
  await expect(popup(page)).toBeVisible();await expect(popup(page).locator('li')).toHaveCount(2);await expect(popup(page).getByRole('button',{name:'OK'})).toBeFocused()
  await page.keyboard.press('Escape');await expect(popup(page)).not.toBeVisible()
  await expect(page.locator('.signup-wizard')).toHaveAttribute('data-signup-step','1');await expect(page.getByLabel('First Name',{exact:true})).toHaveValue('');await expect(page.getByLabel('Last Name',{exact:true})).toHaveValue('')
 }
})
test('account validation and both availability errors stay on Step 2 and reset only username/email',async({page})=>{
 await setup(page);await personal(page)
 await page.getByLabel('Username',{exact:true}).fill('abc_123');await page.getByLabel('Email address',{exact:true}).fill('not-an-email');await page.getByRole('button',{name:'Next',exact:true}).click()
 await expect(popup(page).locator('li')).toHaveCount(2);await popup(page).getByRole('button',{name:'OK'}).click()
 for(const bad of ['a'.repeat(7),'a'.repeat(21),'Player_99','Player 99']){
  await page.getByLabel('Username',{exact:true}).fill(bad);await page.getByLabel('Email address',{exact:true}).fill('person@example.test');await page.getByRole('button',{name:'Next',exact:true}).click();await expect(popup(page)).toBeVisible();await popup(page).getByRole('button',{name:'OK'}).click()
 }
 await page.route('**/api/auth/availability',r=>r.fulfill({json:{usernameAvailable:false,emailAvailable:false}}))
 await page.getByLabel('Username',{exact:true}).fill('AlreadyTaken99');await page.getByLabel('Email address',{exact:true}).fill('taken@example.test');await page.getByRole('button',{name:'Next',exact:true}).click()
 await expect(popup(page)).toContainText('username is already taken');await expect(popup(page)).toContainText('email address is already registered');await popup(page).getByRole('button',{name:'OK'}).click()
 await expect(page.getByLabel('Username',{exact:true})).toHaveValue('');await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('')
 await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByLabel('First Name',{exact:true})).toHaveValue('John');await expect(page.getByLabel('Last Name',{exact:true})).toHaveValue('Smith')
})
test('password visibility and existing rules remain; dismissed errors clear passwords only',async({page})=>{
 await setup(page);await passwordStep(page)
 const password=page.getByLabel('Password',{exact:true}),confirmation=page.getByLabel('Confirm Password',{exact:true})
 await password.fill('short');await confirmation.fill('different');await page.getByRole('button',{name:'Create account'}).click();await expect(popup(page)).toContainText('at least 8');await expect(popup(page)).toContainText('do not match')
 await popup(page).getByRole('button',{name:'OK'}).click();await expect(password).toHaveValue('');await expect(confirmation).toHaveValue('')
 await password.fill(' a long passphrase ');await confirmation.fill(' a long passphrase ');await page.getByRole('button',{name:'Show password',exact:true}).click();await expect(password).toHaveAttribute('type','text');await expect(confirmation).toHaveAttribute('type','password');await expect(password).toHaveValue(' a long passphrase ')
 await page.getByRole('button',{name:'Show confirm password',exact:true}).click();await expect(confirmation).toHaveAttribute('type','text')
 let calls=0
 await page.route('**/api/auth/register',async r=>{calls++;const payload=r.request().postDataJSON();expect(payload).toMatchObject({email:'person+tag@example.com',password:' a long passphrase ',data:{username:'cardmaster99',first_name:'John',last_name:'Smith'},code_challenge_method:'s256'});expect(payload.code_challenge).toHaveLength(43);await new Promise(resolve=>setTimeout(resolve,100));await r.fulfill({json:{id:'new-id',email:'person+tag@example.com',identities:[{}]}})})
 await page.getByRole('button',{name:'Create account'}).click();await page.locator('.signup-form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 await expect(page.getByRole('status')).toContainText('verification link');expect(calls).toBe(1)
 expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.endsWith('-code-verifier')))).toBe(true)
})
test('a final server race error remains at Step 3 and resets only passwords',async({page})=>{
 await setup(page);await passwordStep(page)
 await page.route('**/api/auth/register',r=>r.fulfill({status:409,json:{error:'This username is already taken. Please choose another.'}}))
 await page.getByLabel('Password',{exact:true}).fill('valid password');await page.getByLabel('Confirm Password',{exact:true}).fill('valid password');await page.getByRole('button',{name:'Create account'}).click()
 await expect(popup(page)).toContainText('already taken');await popup(page).getByRole('button',{name:'OK'}).click();await expect(page.locator('.signup-wizard')).toHaveAttribute('data-signup-step','3');await expect(page.getByLabel('Password',{exact:true})).toHaveValue('')
 await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByLabel('Username',{exact:true})).toHaveValue('cardmaster99');await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('person+tag@example.com')
})
test('signup stays usable with the mobile keyboard and retained field values',async({page})=>{
 await setup(page);await page.getByLabel('First Name',{exact:true}).fill('John');await keyboard(page,true);await bounds(page)
 await page.getByRole('button',{name:'Next field'}).click();await page.getByLabel('Last Name',{exact:true}).fill('Smith');await page.getByRole('button',{name:'Next',exact:true}).click();await bounds(page)
 await page.getByLabel('Username',{exact:true}).fill('KeyboardUser99');await page.getByRole('button',{name:'Next field'}).click();await page.getByLabel('Email address',{exact:true}).fill('keyboard@example.test');await page.getByRole('button',{name:'Next',exact:true}).click();await bounds(page)
 await page.getByLabel('Password',{exact:true}).fill('valid password');await page.getByRole('button',{name:'Next field'}).click();await page.getByLabel('Confirm Password',{exact:true}).fill('valid password');await bounds(page);await keyboard(page,false);await bounds(page)
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
        'person+tag@example.com',
      )
      await bounds(page)
    } finally {
      await context.close()
    }
  })

test('keyboard-height popup remains reachable and clears only the failing step',async({page})=>{
 await setup(page);await page.getByLabel('First Name',{exact:true}).fill('John123');await keyboard(page,true);await page.getByRole('button',{name:'Next field'}).click();await page.getByRole('button',{name:'Next',exact:true}).click()
 await expect(popup(page)).toBeVisible();await bounds(page);await popup(page).getByRole('button',{name:'OK'}).click();await expect(page.getByLabel('First Name',{exact:true})).toHaveValue('');await keyboard(page,false)
})
