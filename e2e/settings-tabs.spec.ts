import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mock, png } from './career-fixture'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function setup(page: Page) {
  const state = await mock(page)
  const profile = { username: 'cardmaster99', firstName: 'John', lastName: 'Smith', needsCompletion: false }
  Object.assign(state.user, { profile }); Object.assign(state.user.player, profile)
  await page.route('**/api/username?**', route => route.fulfill({ json: { available: true } }))
  return { ...state, profile }
}
async function fits(page: Page) {
  const failures = await page.locator('.settings-panel').evaluate(root => Array.from(root.querySelectorAll('button,input,select,[role=status],[role=alert]')).filter(el => el.checkVisibility() && !el.closest('[hidden]')).flatMap(el => {
    const r = el.getBoundingClientRect()
    return r.x < 0 || r.y < 0 || r.right > innerWidth + 1 || r.bottom > (parseFloat(getComputedStyle(root.closest('[data-mobile-device]') || document.documentElement).getPropertyValue('--app-height')) || innerHeight) + 1 ? [el.textContent || el.getAttribute('name') || el.tagName] : []
  }))
  expect(failures).toEqual([])
  const dimensions = await page.locator('.dashboard-page').evaluate(el => ({ height:el.clientHeight,scroll:el.scrollHeight, children:Array.from(el.querySelectorAll('.settings-panel,.settings-layout,.settings-content,[role=tabpanel],.settings-profile-editor,.screen-pages,.screen-page-content,.screen-page,.identity-editor,form')).filter(el=>el.checkVisibility()).map(el=>({class:el.className,height:el.clientHeight,scroll:el.scrollHeight,bottom:el.getBoundingClientRect().bottom,margin:getComputedStyle(el).margin,padding:getComputedStyle(el).padding})) }))
  if(dimensions.scroll>dimensions.height)await page.screenshot({path:'/tmp/settings-overflow.png'})
  expect(dimensions.scroll,JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.height)
}
for (const [width, height] of [[1440, 900], [844, 390], [667, 375], [568, 320], [480, 320]]) {
  test(`Account, Sounds and Profile remain compact at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: iphone } : {}) })
    try {
      const page = await context.newPage(); await setup(page); await page.goto('/')
      await expect(page.locator('.lounge-home')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toHaveCount(0)
      await page.getByRole('link', { name: 'Settings', exact: true }).click()
      const tabs = page.getByRole('tablist', { name: 'Settings sections' })
      await expect(tabs.getByRole('tab')).toHaveText(['Account', 'Sounds', 'Profile'])
      await expect(page.getByRole('tab', { name: 'Account', exact: true })).toHaveAttribute('aria-selected','true')
      await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Back to Lounge' })).toHaveCount(0)
      const boxes = await tabs.getByRole('tab').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height } }))
      expect(new Set(boxes.map(r => r.width)).size).toBe(1); expect(new Set(boxes.map(r => r.height)).size).toBe(1)
      expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height)
      expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height)
      await fits(page)
      await page.getByRole('tab', { name: 'Sounds', exact: true }).click()
      await expect(page.getByRole('checkbox', { name: 'Sound Effects', exact: true })).toBeVisible()
      await expect(page.getByRole('checkbox', { name: 'Vibration', exact: true })).toBeVisible()
      await expect(page.getByRole('checkbox', { name: 'Turn Notifications', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toHaveCount(0)
      await fits(page)
      await page.getByRole('tab', { name: 'Profile', exact: true }).click()
      await expect(page.getByLabel('First Name', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Last Name', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0)
      await expect(page.getByLabel('Display name', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Save identity', exact: true })).toBeEnabled()
      await fits(page)
      if (width < 1000) await page.getByRole('combobox', { name: 'Profile fields', exact: true }).selectOption('1')
      await expect(page.getByLabel('Profile picture', { exact: true })).toBeVisible()
      await fits(page)
      if (width === 568) await page.screenshot({ path:'/tmp/settings-profile-photo-568.png' })
      await page.getByRole('tab', { name: 'Account', exact: true }).click()
      await page.getByRole('tab', { name: 'Account', exact: true }).focus(); await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('tab', { name: 'Sounds', exact: true })).toBeFocused()
      await expect(page.getByRole('tab', { name: 'Sounds', exact: true })).toHaveAttribute('aria-selected','true')
      if (width === 568) await page.screenshot({ path:'/tmp/settings-sounds-568.png' })
      await page.reload()
      await expect(page.getByRole('tab', { name: 'Account', exact: true })).toHaveAttribute('aria-selected','true')
      await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      await expect(page.locator('.lounge-home')).toBeVisible()
    } finally { await context.close() }
  })
}

test('Settings identity validation and photo retry reuse owner endpoints and refresh the header', async ({ page }) => {
  const state = await setup(page)
  let unavailable = true, failUpload = true, identityRequests = 0, uploads = 0
  await page.route('**/api/username?**', route => route.fulfill({ json: { available: !unavailable || !route.request().url().includes('takenuser99') } }))
  await page.route('**/api/profile/identity', route => {
    const values = route.request().postDataJSON()
    expect(values).toEqual({ username:'newmaster99',firstName:'Jane',lastName:'Smith' })
    identityRequests++; Object.assign(state.user.player,values); Object.assign(state.profile,values)
    return route.fulfill({ json:{user:state.user} })
  })
  await page.route('**/api/profile/avatar', route => {
    if (route.request().method()==='DELETE') { state.user.player.avatarUrl=null; return route.fulfill({json:{user:state.user}}) }
    uploads++; expect(route.request().headers()['content-type']).toBe('image/webp')
    if (failUpload) return route.fulfill({status:503,json:{error:'Upload temporarily unavailable'}})
    state.user.player.avatarUrl='/test-avatar-new.png'; return route.fulfill({json:{user:state.user}})
  })
  await page.goto('/#/settings'); await page.getByRole('tab',{name:'Profile',exact:true}).click()
  const username = page.getByLabel('Username',{exact:true}), save = page.getByRole('button',{name:'Save identity',exact:true})
  await username.fill('bad_'); await expect(save).toBeDisabled()
  await username.fill('takenuser99'); await expect(page.getByText('Username already taken.',{exact:true})).toBeVisible(); await expect(save).toBeDisabled()
  await page.getByLabel('First Name',{exact:true}).fill(''); await username.fill('newmaster99'); await expect(save).toBeDisabled()
  await page.getByLabel('First Name',{exact:true}).fill(' Jane '); await expect(save).toBeEnabled(); await save.click()
  await expect(page.getByText('Your public name and username are saved.',{exact:true})).toBeVisible()
  await expect(page.locator('.header-profile-lines')).toContainText('Jane Smith'); await expect(page.locator('.header-profile-lines')).toContainText('@newmaster99')
  expect(identityRequests).toBe(1)
  const picture = page.getByLabel('Profile picture',{exact:true})
  await picture.setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')}); await expect(page.getByRole('alert')).toBeVisible()
  await picture.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png})
  await expect(page.locator('.settings-profile-editor .profile-avatar img')).toHaveAttribute('src',/^blob:/)
  await page.getByRole('tab',{name:'Account',exact:true}).click(); await page.getByRole('tab',{name:'Profile',exact:true}).click()
  await expect(page.locator('.settings-profile-editor .profile-avatar img')).toHaveAttribute('src',/^blob:/)
  await page.getByRole('button',{name:'Save profile',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('Upload temporarily unavailable')
  failUpload=false; await page.getByRole('button',{name:'Retry save',exact:true}).click(); await expect(page.getByText('Your profile is saved.',{exact:true})).toBeVisible()
  expect(uploads).toBe(2); await expect(page.locator('.header-profile .profile-avatar img')).toHaveAttribute('src','/test-avatar-new.png')
  await page.getByRole('button',{name:'Remove picture',exact:true}).click(); await expect(page.locator('.header-profile .profile-avatar img')).toHaveCount(0)
})

test('Account sign-out retains error recovery and clears the existing session', async ({ page }) => {
  const state = await setup(page); let signedOut=false, fail=true
  await page.route('**/api/session', route => route.fulfill({json:{user:signedOut?null:state.user,room:null}}))
  await page.route('**/api/logout', route => {
    expect(route.request().method()).toBe('POST')
    if(fail) return route.fulfill({status:503,json:{error:'Please retry sign out'}})
    signedOut=true; return route.fulfill({json:{ok:true}})
  })
  await page.goto('/#/settings'); await page.getByRole('button',{name:'Sign Out',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Please retry sign out'); fail=false
  await page.getByRole('button',{name:'Sign Out',exact:true}).click()
  await expect(page.getByRole('button',{name:'Continue as Guest',exact:true})).toBeVisible()
  await page.reload(); await expect(page.getByRole('link',{name:'Your profile',exact:true})).toHaveCount(0)
})

test('guest Account retains session exit and Profile exposes no editing fields', async ({ page }) => {
  const state=await setup(page); state.user.player.accountType='guest'
  await page.goto('/#/settings'); await expect(page.getByRole('button',{name:'Leave Guest Session',exact:true})).toBeVisible()
  await page.getByRole('tab',{name:'Profile',exact:true}).click()
  await expect(page.getByText('Profile editing is available to registered accounts.',{exact:true})).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
})

test('small landscape photo errors, retries and success messages remain within the panel', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:480,height:320},isMobile:true,hasTouch:true,userAgent:iphone})
  try {
    const page=await context.newPage(),state=await setup(page);state.user.player.avatarUrl='/test-avatar-old.png';let fail=true
    await page.route('**/api/profile/avatar',route=>{
      if(fail)return route.fulfill({status:503,json:{error:'Upload temporarily unavailable'}})
      state.user.player.avatarUrl='/test-avatar-new.png';return route.fulfill({json:{user:state.user}})
    })
    await page.goto('/#/settings');await page.getByRole('tab',{name:'Profile',exact:true}).click()
    await page.getByRole('combobox',{name:'Profile fields',exact:true}).selectOption('1')
    const input=page.getByLabel('Profile picture',{exact:true})
    await input.setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')})
    await expect(page.getByRole('alert')).toBeVisible();await fits(page)
    await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png})
    await page.getByRole('button',{name:'Save profile',exact:true}).click()
    await expect(page.getByRole('alert')).toContainText('Upload temporarily unavailable');await fits(page)
    fail=false;await page.getByRole('button',{name:'Retry save',exact:true}).click()
    await expect(page.getByText('Your profile is saved.',{exact:true})).toBeVisible();await fits(page)
    await page.screenshot({path:'/tmp/settings-profile-saved-480.png'})
  } finally {await context.close()}
})

test('Profile retains compact field navigation when the mobile keyboard is open', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:667,height:375},isMobile:true,hasTouch:true,userAgent:iphone})
  try {
    const page=await context.newPage();await setup(page);await page.goto('/#/settings')
    await page.getByRole('tab',{name:'Profile',exact:true}).click();await page.getByLabel('First Name',{exact:true}).focus()
    await page.evaluate(()=>{Object.defineProperty(visualViewport!,'height',{configurable:true,get:()=>170});visualViewport!.dispatchEvent(new Event('resize'))})
    await expect(page.locator('[data-keyboard=true]')).toHaveCount(1)
    await expect(page.getByLabel('First Name',{exact:true})).toBeVisible();await fits(page)
    await page.getByRole('button',{name:'Next field',exact:true}).click()
    await expect(page.getByLabel('Last Name',{exact:true})).toBeVisible();await fits(page)
  } finally {await context.close()}
})
