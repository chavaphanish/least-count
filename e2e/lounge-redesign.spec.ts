import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'

for (const [width, height] of [[1440, 900], [1280, 800], [1024, 600], [844, 390], [667, 375], [568, 320], [480, 320]]) {
  test(`Lounge columns, golden actions and navigation fit at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: iphone } : {}) })
    try {
      const page = await context.newPage(), state = await mock(page)
      Object.assign(state.user.player, { firstName: 'Career', lastName: 'Tester', username: 'lc_owner' })
      await page.goto('/')
      const lounge = page.locator('.dashboard-page')
      await expect(lounge.getByRole('heading', { name: 'Welcome back, Career!' })).toBeVisible()
      await expect(page.getByRole('banner').getByRole('link', { name: 'Profile', exact: true })).toHaveCount(0)
      await expect(page.getByRole('banner').getByRole('progressbar')).toHaveAttribute('value', '250')
      await expect(lounge.locator('.profile-avatar, progress')).toHaveCount(0)
      await expect(lounge.getByText(/YOUR NEXT CARD|Your next card game/i)).toHaveCount(0)
      await expect(lounge.getByRole('link', { name: 'How to Play', exact: true })).toHaveCount(0)
      await expect(lounge.getByRole('link', { name: /Local Practice/i })).toHaveCount(1)
      const actions = lounge.getByRole('group', { name: 'Game options' })
      const controls = actions.locator('.lounge-nav-button'), boxes = await controls.evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, color: getComputedStyle(el).backgroundColor }
      }))
      expect(boxes).toHaveLength(4)
      expect(Math.max(...boxes.map(r => r.width))-Math.min(...boxes.map(r => r.width)),JSON.stringify(boxes)).toBeLessThan(1)
      expect(Math.max(...boxes.map(r => r.height))-Math.min(...boxes.map(r => r.height)),JSON.stringify(boxes)).toBeLessThan(1)
      expect(new Set(boxes.slice(1).map(r => r.color)).size).toBe(1)
      expect(boxes[0].color).not.toBe(boxes[1].color)
      expect(boxes[0].height).toBeGreaterThanOrEqual(44)
      expect(boxes[1].y).toBe(boxes[0].y)
      expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width)
      expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height)
      expect(boxes[3].y).toBe(boxes[2].y)
      expect(boxes[3].x).toBe(boxes[1].x)
      await lounge.getByRole('link', { name: 'Tutorial', exact: true }).click()
      await page.getByRole('link',{name:'Exit Tutorial'}).click()
      const welcome = await lounge.locator('.lounge-welcome').boundingBox()
      expect(welcome!.x + welcome!.width).toBeLessThan(boxes[0].x)
      await expect(lounge.getByRole('button', { name: 'Leaderboards', exact: true })).toHaveCount(0)
      const outside = await lounge.locator('button,a').evaluateAll(els => els.filter(el => el.checkVisibility()).filter(el => {
        const r = el.getBoundingClientRect()
        return r.x < 0 || r.y < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1
      }).map(el => el.textContent))
      expect(outside).toEqual([])
      expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({width,height})
      const header = page.getByRole('banner')
      const geometry = await header.boundingBox()
      await page.getByRole('link',{name:'Rules',exact:true}).click()
      expect(await header.boundingBox()).toEqual(geometry)
      await page.getByRole('link',{name:'Lounge',exact:true}).click()
      await expect(page.locator('.startup-screen')).not.toBeVisible()
      await page.screenshot({ path: `/tmp/lounge-redesign-${width}.png` })
      await page.route('**/api/rooms', route => route.fulfill({ status: 503, json: { error: 'Please retry hosting.' } }))
      await lounge.getByRole('button', { name: 'Host a Game', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('Please retry hosting.')
      await expect(page.getByRole('button', { name: 'Create Room', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Join Game Room', exact: true }).click()
      await expect(page.getByLabel('Room code')).toBeVisible()
      await page.getByRole('button', { name: 'Back to Lounge' }).click()
      await page.getByRole('link', { name: 'Settings', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      await page.getByRole('link', { name: 'Buddies', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Buddies', exact: true })).toBeVisible()
      await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      await page.getByRole('link', { name: 'Local Practice', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Start local game' })).toBeVisible()
    } finally { await context.close() }
  })
}

test('new players receive their full-name welcome even when activity timestamps differ', async ({ page }) => {
  const state = await mock(page)
  Object.assign(state.user.player, { firstName: 'John', lastName: 'Smith', username: 'johnsmith' })
  state.me.gamesPlayed = 0; state.me.xp = 0
  await page.route('**/api/career?op=profile', route => route.fulfill({ json: { profile: state.me, statistics: { gamesStarted: 0 }, config: { levelBase: 50 } } }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome, John Smith!' })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('progressbar')).toHaveAttribute('value', '0')
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toHaveCount(0)
})

test('guest room restrictions and Local Practice entry are preserved', async ({ page }) => {
  const state = await mock(page); state.user.player.accountType = 'guest'
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome, Career Tester!' })).toBeVisible()
  await page.getByRole('link',{name:'Tutorial',exact:true}).click()
  await page.getByRole('link',{name:'Exit Tutorial'}).click()
  for (const action of ['Host a Game', 'Join Game Room']) {
    await page.getByRole('button', { name: action, exact: true }).click()
    const notice = page.getByRole('alertdialog')
    await expect(notice).toContainText('Multiplayer Online Mode for Guests is currently under testing.')
    await notice.getByRole('button', { name: 'OK', exact: true }).click()
  }
  await page.getByRole('link', { name: 'Local Practice', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start local game' })).toBeVisible()
})

test('room and profile-completion notices fit the smallest mobile landscape Lounge', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true, userAgent: iphone })
  try {
    const page = await context.newPage(), state = await mock(page)
    Object.assign(state.user, { profile: { needsCompletion: true } })
    await page.route('**/api/session', route => route.fulfill({ json: { user: state.user, room: { id: 'room', code: 'ABC234' } } }))
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Return to your room' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Update profile' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Welcome back, Career Tester!' })).toBeVisible()
    expect(await page.locator('.dashboard-page').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true)
    await page.screenshot({ path: '/tmp/lounge-redesign-notices.png' })
  } finally { await context.close() }
})

test('long names preserve the complete greeting and fit a small landscape viewport',async({browser})=>{
  const context=await browser.newContext({viewport:{width:480,height:320},isMobile:true,hasTouch:true,userAgent:iphone})
  try {
    const page=await context.newPage(),state=await mock(page)
    const firstName='Alexandria'.repeat(8),lastName='Montgomery'.repeat(8)
    Object.assign(state.user.player,{firstName,lastName,username:'longname99'})
    state.me.gamesPlayed=0;state.me.xp=0
    await page.route('**/api/career?op=profile',route=>route.fulfill({json:{profile:state.me,statistics:{gamesStarted:0},config:{levelBase:50}}}))
    await page.goto('/')
    const greeting=page.getByRole('heading',{name:`Welcome, ${firstName} ${lastName}!`,exact:true})
    await expect(greeting).toBeVisible()
    const bounds=await greeting.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(320)
    expect(await page.locator('.lounge-home').evaluate(el=>el.scrollHeight<=el.clientHeight && el.scrollWidth<=el.clientWidth)).toBe(true)
  }finally{await context.close()}
})
