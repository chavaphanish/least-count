import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function clock(page: Page) {
  const now = new Date('2026-11-11T12:00:00Z')
  await page.clock.install({time:now})
  await page.clock.pauseAt(new Date(now.getTime() + 60_000))
}
async function config(page: Page) {
  await page.route('**/api/config', r => r.fulfill({json:{service:'least-count',supabase:null}}))
}
async function session(page: Page) {
  await page.route('**/api/session', r=>r.fulfill({json:{user:null,room:null}}))
}
const fill = (page: Page) => page.locator('.loading-logo').getAttribute('data-fill').then(Number)
// Count actual artwork pixels inside the rendered clipping boundary, ignoring
// the transparent canvas margins. This catches a visually complete slow load.
async function visibleGold(page: Page) {
  return page.locator('.loading-logo').evaluate(async element => {
    const image = element.querySelector('img')!
    await image.decode()
    const clip = getComputedStyle(element.querySelector('.loading-logo-gold')!).clipPath
    const right = Number(clip.match(/([\d.]+)%/)![1])
    const edge = image.naturalWidth * (1 - right / 100)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let gold = 0, total = 0
    for (let i = 3; i < pixels.length; i += 4) {
      if (!pixels[i]) continue
      total++
      if (((i - 3) / 4) % canvas.width + .5 < edge) gold++
    }
    return { gold, total }
  })
}
for (const mobile of [false,true]) test.describe(mobile?'mobile animated splash':'desktop animated splash',()=>{
  test.use({viewport:mobile?{width:844,height:390}:{width:1280,height:800},...(mobile?{userAgent:iphone,isMobile:true,hasTouch:true}:{})})
  test('fast initialization proceeds independently while the white logo fills over at least three seconds',async({page})=>{
    await clock(page); await config(page); await session(page)
    await page.goto('/')
    const loading=page.locator('.startup-screen')
    await expect(loading).toHaveAttribute('data-ready','true')
    expect(await fill(page)).toBe(0)
    await expect(page.locator('.loading-logo-white')).toHaveCSS('filter','brightness(0) invert(1)')
    expect((await visibleGold(page)).gold).toBe(0)
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(page.locator('.loading-spinner,.startup-progress')).toHaveCount(0)
    await expect(loading).not.toContainText('%')
    const layers=await page.locator('.loading-logo img').evaluateAll(images=>images.map(image=>{const b=image.getBoundingClientRect();return [b.x,b.y,b.width,b.height]}))
    expect(layers[0]).toEqual(layers[1])
    await page.clock.runFor(1000)
    const first=await fill(page)
    expect(first).toBeGreaterThan(.2); expect(first).toBeLessThan(.5)
    await page.clock.runFor(1900)
    expect(await fill(page)).toBeGreaterThan(first)
    expect(await fill(page)).toBeLessThan(1)
    await expect(loading).toBeVisible()
    await expect(page.getByRole('button',{name:'Continue as Guest',exact:true})).toHaveCount(0)
    await page.clock.runFor(200)
    expect(await fill(page)).toBe(1)
    const completed = await visibleGold(page)
    expect(completed.gold).toBe(completed.total)
    await page.clock.runFor(500)
    await expect(loading).toHaveCount(0)
    await expect(page.getByRole('button',{name:'Continue as Guest',exact:true})).toBeVisible()
  })
})
test.describe('slow and interrupted splash',()=>{
  test.use({viewport:{width:844,height:390},userAgent:iphone,isMobile:true,hasTouch:true})
  test('slow initialization stays below full gold, survives rotation/background events, and completes only when ready',async({page})=>{
    await clock(page); await config(page)
    let release!:()=>void
    const gate=new Promise<void>(resolve=>{release=resolve})
    await page.route('**/api/session',async r=>{await gate;await r.fulfill({json:{user:null,room:null}})})
    await page.goto('/')
    await expect(page.getByRole('status')).toContainText('Preparing your profile')
    await page.clock.runFor(3000)
    const before=await fill(page)
    expect(before).toBeGreaterThan(.5);expect(before).toBeLessThan(1)
    await page.setViewportSize({width:390,height:844})
    const portrait=page.getByRole('dialog',{name:'Rotate Your Phone'})
    await expect(portrait.getByRole('img',{name:'Chavium Games'})).toBeVisible()
    await expect(portrait.locator('.loading-logo')).toHaveCount(0)
    await page.evaluate(()=>{window.dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'))})
    await page.clock.runFor(5000)
    await page.setViewportSize({width:844,height:390})
    expect(await fill(page)).toBeGreaterThanOrEqual(before)
    expect(await fill(page)).toBeLessThan(.95)
    const pending = await visibleGold(page)
    expect(pending.gold).toBeGreaterThan(0)
    expect(pending.gold).toBeLessThan(pending.total)
    await expect(page.locator('.startup-screen')).not.toHaveAttribute('data-ready')
    release()
    await expect(page.locator('.startup-screen')).toHaveAttribute('data-ready','true')
    await page.clock.runFor(200)
    expect(await fill(page)).toBeLessThan(1)
    await page.clock.runFor(200)
    expect(await fill(page)).toBe(1)
    await page.clock.runFor(400)
    await expect(page.locator('.startup-screen')).toHaveCount(0)
  })
  test('failure exposes retry immediately and retry uses a fresh minimum without delaying initialization',async({page})=>{
    await clock(page)
    let failed=true
    await page.route('**/api/config',r=>r.fulfill(failed?{status:503,json:{error:'Service unavailable'}}:{json:{service:'least-count',supabase:null}}))
    await session(page);await page.goto('/')
    await expect(page.getByRole('alert')).toContainText('Service unavailable')
    failed=false
    await page.getByRole('button',{name:'Retry initialization'}).click()
    await expect(page.locator('.startup-screen')).toHaveAttribute('data-ready','true')
    expect(await fill(page)).toBe(0)
    await page.clock.runFor(2900)
    await expect(page.locator('.startup-screen')).toBeVisible()
    await page.clock.runFor(600)
    await expect(page.locator('.startup-screen')).toHaveCount(0)
  })
})
test('missing artwork falls back to studio text without blocking readiness',async({page})=>{
  await clock(page);await config(page);await session(page)
  await page.route('**/branding/chavium-games-gold.png',r=>r.fulfill({status:404,body:''}))
  await page.goto('/')
  await expect(page.locator('.studio-logo-fallback')).toHaveText('Chavium Games')
  await page.clock.runFor(3500)
  await expect(page.getByRole('button',{name:'Continue as Guest',exact:true})).toBeVisible()
})
test('reduced motion uses a static white logo followed by full gold and still honors the minimum',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await clock(page);await config(page);await session(page);await page.goto('/')
  await expect(page.locator('.startup-screen')).toHaveAttribute('data-ready','true')
  await page.clock.runFor(1500)
  expect(await fill(page)).toBe(0)
  await page.clock.runFor(1600)
  expect(await fill(page)).toBe(1)
  await page.clock.runFor(400)
  await expect(page.locator('.startup-screen')).toHaveCount(0)
})

test('restored room connects behind the splash and stays mounted after the minimum',async({page})=>{
  await clock(page);await config(page)
  const user={player:{id:'guest:host',displayName:'Host',avatarUrl:null,accountType:'guest'},email:null,createdAt:'2026-11-11T12:00:00Z',lastActiveAt:'2026-11-11T12:00:00Z'}
  await page.route('**/api/session',r=>r.fulfill({json:{user,room:{id:'room',code:'ABC234'}}}))
  const room={id:'room',code:'ABC234',hostId:user.player.id,settings:{maxPlayers:2,timedGame:false,turnDurationSeconds:null,eliminationThreshold:100},status:'waiting',revision:1,serverNow:new Date('2026-11-11T12:01:00Z').getTime(),game:null,members:[{...user.player,order:0,connected:true,lastSeen:0,disconnectedAt:null,authExpiresAt:10**15,left:false}]}
  let joins=0, sockets=0
  await page.route('**/api/rooms/ABC234/join',r=>{joins++;return r.fulfill({json:room})})
  await page.route('**/api/rooms/ABC234/ticket',r=>r.fulfill({json:{ticket:'test'}}))
  await page.routeWebSocket('**/api/rooms/ABC234/ws**',socket=>{sockets++;socket.onMessage(()=>{})})
  await page.goto('/#/room/ABC234')
  await expect(page.locator('.startup-screen')).toHaveAttribute('data-ready','true')
  await expect(page.locator('.connection-live')).toHaveCount(1)
  const initialJoins=joins, initialSockets=sockets
  expect(initialJoins).toBeGreaterThan(0);expect(initialSockets).toBeGreaterThan(0)
  await expect(page.locator('.room-page')).toBeHidden()
  const mounted=await page.locator('.room-page').elementHandle()
  await page.clock.runFor(3500)
  await expect(page.locator('.room-page')).toBeVisible()
  expect(await mounted!.evaluate(node=>node===document.querySelector('.room-page'))).toBe(true)
  expect(joins).toBe(initialJoins);expect(sockets).toBe(initialSockets)
})
