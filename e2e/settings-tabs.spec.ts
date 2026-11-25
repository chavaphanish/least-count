import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mock, png } from './career-fixture'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function setup(page: Page) {
  const state = await mock(page)
  const profile = { username: 'cardmaster99', firstName: 'John', lastName: 'Smith', needsCompletion: false }
  Object.assign(state.user, { profile }); Object.assign(state.user.player, profile)
  await page.route('**/api/username?**', route => route.fulfill({ json: { available: true } }))
  await page.route('**/api/profile/identity', route => { Object.assign(profile,route.request().postDataJSON()); Object.assign(state.user.player,profile); return route.fulfill({json:{user:state.user}}) })
  return { ...state, profile }
}
async function fits(page: Page) {
  const failures = await page.locator('.settings-panel').evaluate(root => Array.from(root.querySelectorAll('button,input,select,[role=status],[role=alert]')).filter(el => el.checkVisibility() && !el.closest('[hidden]')).flatMap(el => {
    const r = el.getBoundingClientRect()
    return r.x < 0 || r.y < 0 || r.right > innerWidth + 1 || r.bottom > (parseFloat(getComputedStyle(root.closest('[data-mobile-device]') || document.documentElement).getPropertyValue('--app-height')) || innerHeight) + 1 ? [el.textContent || el.getAttribute('name') || el.tagName] : []
  }))
  expect(failures).toEqual([])
  const overflow = await page.locator('.settings-profile-editor, .compact-profile-editor, .compact-profile-editor form').evaluateAll(els=>els.filter(el=>el.checkVisibility()).filter(el=>el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1).map(el=>({class:el.className,height:el.clientHeight,scrollHeight:el.scrollHeight,width:el.clientWidth,scrollWidth:el.scrollWidth})))
  expect(overflow).toEqual([])
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
      await expect(page.locator('.account-created')).toHaveText('Account Created: 1 January 2026')
      await expect(page.locator('.account-created time')).toHaveAttribute('datetime', '2026-01-01T00:00:00Z')
      const actionStyles = await page.locator('.account-actions > .button').evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect(), style = getComputedStyle(button)
        return { width: rect.width, height: rect.height, font: style.font, padding: style.padding, radius: style.borderRadius }
      }))
      expect(actionStyles).toHaveLength(2)
      expect(actionStyles[0]).toEqual(actionStyles[1])
      await expect(page.getByRole('button', { name: 'Back to Lounge' })).toHaveCount(0)
      const boxes = await tabs.getByRole('tab').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height } }))
      expect(new Set(boxes.map(r => r.width)).size).toBe(1); expect(Math.max(...boxes.map(r => r.height)) - Math.min(...boxes.map(r => r.height))).toBeLessThan(1)
      await expect(page.getByRole('heading', {name:'Settings', exact:true})).toHaveCount(0)
      const content = (await page.locator('.settings-content').boundingBox())!
      expect(Math.abs(boxes[0].y - content.y)).toBeLessThan(1)
      expect(Math.abs(boxes[2].y + boxes[2].height - content.y - content.height)).toBeLessThan(1)
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
      await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeEnabled()
      await fits(page)
      await expect(page.getByRole('combobox', { name: 'Profile fields', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Edit profile picture', exact: true })).toBeVisible()
      await fits(page)
      if (width === 568) await page.screenshot({ path:'/tmp/settings-profile-photo-568.png' })
      await page.getByRole('tab', { name: 'Account', exact: true }).click()
      await page.getByRole('tab', { name: 'Account', exact: true }).focus(); await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('tab', { name: 'Sounds', exact: true })).toBeFocused()
      await expect(page.getByRole('tab', { name: 'Sounds', exact: true })).toHaveAttribute('aria-selected','true')
      if (width === 568) await page.screenshot({ path:'/tmp/settings-sounds-568.png' })
      await page.reload()
      await expect(page.getByRole('tab', { name: 'Account', exact: true })).toHaveAttribute('aria-selected','true')
      await page.getByRole('link', { name: 'Home', exact: true }).click()
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
  const username = page.getByLabel('Username',{exact:true}), save = page.getByRole('button',{name:'Save Changes',exact:true})
  await username.fill('bad_'); await expect(save).toBeDisabled()
  await username.fill('takenuser99'); await expect(page.getByText('Username already taken.',{exact:true})).toBeVisible(); await expect(save).toBeDisabled()
  await page.getByLabel('First Name',{exact:true}).fill(''); await username.fill('newmaster99'); await expect(save).toBeDisabled()
  await page.getByLabel('First Name',{exact:true}).fill(' Jane '); await expect(save).toBeEnabled(); await save.click()
  await expect(page.getByText('Your profile is saved.',{exact:true})).toBeVisible()
  await expect(page.locator('.header-profile-lines')).toContainText('Jane Smith'); await expect(page.locator('.header-profile-lines')).toContainText('@newmaster99')
  expect(identityRequests).toBe(1)
  const picture = page.getByLabel('Profile picture',{exact:true})
  await picture.setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')}); await expect(page.getByRole('alert')).toBeVisible()
  await picture.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png})
  await expect(page.locator('.compact-profile-editor .profile-avatar img')).toHaveAttribute('src',/^blob:/)
  await page.getByRole('tab',{name:'Account',exact:true}).click(); await page.getByRole('tab',{name:'Profile',exact:true}).click()
  await expect(page.locator('.compact-profile-editor .profile-avatar img')).toHaveAttribute('src',/^blob:/)
  await page.getByRole('button',{name:'Save Changes',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('Upload temporarily unavailable')
  failUpload=false; await page.getByRole('button',{name:'Save Changes',exact:true}).click(); await expect(page.getByText('Your profile is saved.',{exact:true})).toBeVisible()
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
  await expect(page.getByRole('button',{name:'Login as Guest',exact:true})).toBeVisible()
  await page.reload(); await expect(page.getByRole('link',{name:'Your profile',exact:true})).toHaveCount(0)
})

test('guest Account retains session exit and Profile exposes no editing fields', async ({ page }) => {
  const state=await setup(page); state.user.player.accountType='guest'
  await page.goto('/#/settings'); await expect(page.getByRole('button',{name:'Leave Guest Session',exact:true})).toBeVisible()
  await expect(page.locator('.account-created')).toHaveCount(0)
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
    const input=page.getByLabel('Profile picture',{exact:true})
    await input.setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')})
    await expect(page.getByRole('alert')).toBeVisible();await fits(page)
    await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png})
    await page.getByRole('button',{name:'Save Changes',exact:true}).click()
    await expect(page.getByRole('alert')).toContainText('Upload temporarily unavailable');await fits(page)
    fail=false;await page.getByRole('button',{name:'Save Changes',exact:true}).click()
    await expect(page.getByText('Your profile is saved.',{exact:true})).toBeVisible();await fits(page)
    await page.screenshot({path:'/tmp/settings-profile-saved-480.png'})
  } finally {await context.close()}
})

test('Profile shows all fields together when the mobile keyboard is open', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:667,height:375},isMobile:true,hasTouch:true,userAgent:iphone})
  try {
    const page=await context.newPage();await setup(page);await page.goto('/#/settings')
    await page.getByRole('tab',{name:'Profile',exact:true}).click();await page.getByLabel('First Name',{exact:true}).focus()
    await page.evaluate(()=>{Object.defineProperty(visualViewport!,'height',{configurable:true,get:()=>170});visualViewport!.dispatchEvent(new Event('resize'))})
    await expect(page.locator('[data-keyboard=true]')).toHaveCount(1)
    await expect(page.getByLabel('First Name',{exact:true})).toBeVisible();await fits(page)
    await expect(page.getByRole('button',{name:'Next field',exact:true})).toHaveCount(0)
    await expect(page.getByLabel('Username',{exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toBeVisible()
    await expect(page.getByLabel('Last Name',{exact:true})).toBeVisible();await fits(page)
  } finally {await context.close()}
})

test('avatar and overlapping pencil open the existing image chooser',async({page})=>{
  await setup(page);await page.goto('/#/settings');await page.getByRole('tab',{name:'Profile',exact:true}).click()
  const edit=page.getByRole('button',{name:'Edit profile picture',exact:true})
  for(const target of [edit,edit.locator('.profile-photo-pencil')]){
    const chooser=page.waitForEvent('filechooser');await target.click();expect((await chooser).isMultiple()).toBe(false)
  }
  const avatar=await edit.locator('.profile-avatar').boundingBox(),pencil=await edit.locator('.profile-photo-pencil').boundingBox()
  expect(pencil!.x).toBeGreaterThan(avatar!.x+avatar!.width/2);expect(pencil!.y).toBeGreaterThan(avatar!.y+avatar!.height/2)
  expect(pencil!.x).toBeLessThan(avatar!.x+avatar!.width);expect(pencil!.y).toBeLessThan(avatar!.y+avatar!.height)
})

test('account deletion requires explicit confirmation, handles errors and clears the session only after completion',async({page})=>{
  const state=await setup(page);let started=0,complete=false,fail=true
  await page.route('**/api/account',route=>{
    started++;expect(route.request().method()).toBe('DELETE');expect(route.request().postDataJSON()).toEqual({password:'current-password',confirmation:'DELETE'})
    return fail?route.fulfill({status:401,json:{error:'The current password could not be verified.'}}):route.fulfill({status:202,json:{pending:true}})
  })
  await page.route('**/api/account/deletion-status',route=>route.fulfill({json:complete?{complete:true}:{pending:true,retrying:true}}))
  await page.route('**/api/session',route=>route.fulfill({json:{user:complete?null:state.user,room:null}}))
  await page.goto('/#/settings');const trigger=page.getByRole('button',{name:'Delete Account',exact:true});await trigger.click()
  const dialog=page.getByRole('dialog',{name:'Delete Account',exact:true}),submit=dialog.getByRole('button',{name:'Permanently Delete Account',exact:true})
  await expect(dialog).toContainText('permanent and cannot be undone');await expect(submit).toBeDisabled();expect(started).toBe(0)
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused()
  await trigger.click();await dialog.getByLabel('Current password',{exact:true}).fill('current-password');await expect(submit).toBeDisabled()
  await dialog.getByLabel('Type DELETE to confirm',{exact:true}).fill('DELETE');await submit.click();await expect(dialog.getByRole('alert')).toContainText('current password')
  fail=false;await submit.click();await expect(dialog.getByRole('status')).toContainText('retrying automatically');await expect(page.locator('.header-profile')).toBeVisible()
  complete=true;await expect(page.getByRole('button',{name:'Login as Guest',exact:true})).toBeVisible({timeout:10000})
  await expect(page.locator('.header-profile')).toHaveCount(0);expect(new URL(page.url()).hash).toBe('#/')
})


test('registration date uses existing session data and remains stable across time zones', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles', viewport: { width: 480, height: 320 }, isMobile: true, hasTouch: true, userAgent: iphone })
  try {
    const page = await context.newPage(), state = await setup(page)
    state.user.createdAt = '2026-11-17T00:05:00Z'
    await page.goto('/#/settings')
    await expect(page.locator('.account-created')).toHaveText('Account Created: 17 November 2026')
    await page.getByRole('tab', { name: 'Sounds', exact: true }).click()
    await page.getByRole('tab', { name: 'Account', exact: true }).click()
    await expect(page.locator('.account-created time')).toHaveText('17 November 2026')
    await fits(page)
  } finally { await context.close() }
})
