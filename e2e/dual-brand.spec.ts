import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mock } from './career-fixture'
import { auditGame } from './ux-fixture'
import { SESSION_KEY } from '../src/lib/session'

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function clock(page: Page) {
  const now = new Date('2026-11-11T14:00:00Z')
  await page.clock.install({ time: now })
  await page.clock.pauseAt(new Date(now.getTime() + 60_000))
}
async function ready(page: Page) {
  await page.goto('/')
  await expect(page.locator('.startup-screen')).toHaveAttribute('data-ready','true')
  await page.clock.runFor(3500)
  await expect(page.locator('.startup-screen')).toHaveCount(0)
}

test('three artwork layers share zero, midpoint and full progress; captions stay static', async ({page}) => {
  await clock(page)
  await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:null}}))
  await page.route('**/api/session',r=>r.fulfill({json:{user:null,room:null}}))
  await page.goto('/')
  const loading=page.locator('.startup-screen'), fills=loading.locator('.brand-fill')
  await expect(loading).toHaveAttribute('data-ready','true')
  await expect(fills).toHaveCount(3)
  const copyright=loading.getByText('© 2026 Chavium Games Pvt. Ltd.',{exact:true})
  await expect(copyright).toBeVisible()
  const position=await copyright.boundingBox()
  for (const [advance, expected] of [[0,0],[1500,.5],[1600,1]]) {
    await page.clock.runFor(advance)
    const values=await fills.evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('data-fill'))))
    expect(new Set(values).size).toBe(1)
    const boundaries=await fills.evaluateAll(nodes=>nodes.map(n=>{
      const clips=Array.from(n.children).map(child=>Number(getComputedStyle(child).clipPath.match(/([\d.]+)%/)![1]))
      return clips[0]+clips[1]
    }))
    expect(boundaries).toEqual([100,100,100])
    expect(values[0]).toBeCloseTo(expected,1)
    await expect(copyright).toBeVisible()
    expect(await copyright.boundingBox()).toEqual(position)
  }
  const typography=await loading.locator('.yaydu-wordmark').first().evaluate(el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontWeight]})
  expect(typography).toEqual(['"DM Sans", sans-serif','700'])
  const levels=await loading.locator('.loading-logo img').first().evaluate(async el=>{
    const image=el as HTMLImageElement;await image.decode()
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0)
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
    return new Set(Array.from(pixels).filter((_,i)=>i%4===3)).size
  })
  expect(levels).toBeGreaterThan(100)
})

test.describe('small mobile dual branding',()=>{
  test.use({viewport:{width:320,height:480},userAgent:iphone,isMobile:true,hasTouch:true})
  test('portrait is static, complete, readable and fits; landscape resumes without a second splash',async({page})=>{
    await mock(page);await clock(page);await page.goto('/')
    const guard=page.getByRole('dialog',{name:'Rotate Your Phone'})
    await expect(guard.locator('.dual-brand')).toHaveAttribute('data-mode','static')
    await expect(guard.getByRole('img',{name:'YAYDU',exact:true})).toBeVisible()
    await expect(guard.getByRole('img',{name:'Chavium Games',exact:true})).toBeVisible()
    await expect(guard.getByText('Powered by',{exact:true})).toBeVisible()
    await expect(guard.locator('.brand-filled,[role=progressbar]')).toHaveCount(0)
    const outside=await guard.evaluate(el=>Array.from(el.querySelectorAll('img,p,small,svg,h1')).filter(n=>{
      const r=n.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1
    }).map(n=>n.tagName))
    expect(outside).toEqual([])
    await page.screenshot({path:'/tmp/dual-brand-portrait.png'})
    await page.clock.runFor(3500)
    await page.setViewportSize({width:667,height:320})
    await expect(guard).not.toBeVisible()
    await expect(page.locator('.startup-screen')).toHaveCount(0)
  })

  test('major routes and Lounge sections use one short cover, preserving mounted screens',async({page})=>{
    await page.setViewportSize({width:844,height:390})
    await mock(page);await clock(page);await ready(page)
    await page.getByRole('link',{name:'My Profile',exact:true}).click()
    const cover=page.locator('.navigation-loading')
    await expect(cover).toHaveCount(1)
    const profile=page.locator('.profile-panel')
    const mounted=await profile.elementHandle()
    await expect(profile).toBeHidden()
    await page.clock.runFor(700);await expect(cover).toBeVisible()
    await page.clock.runFor(500);await expect(cover).toHaveCount(0)
    expect(await mounted!.evaluate(el=>el===document.querySelector('.profile-panel'))).toBe(true)
    await page.getByRole('link',{name:'Lounge',exact:true}).click()
    await page.clock.runFor(1200)
    await page.getByRole('button',{name:'Settings',exact:true}).click()
    await expect(cover).toHaveCount(1)
    await page.clock.runFor(1200)
    await page.getByRole('button',{name:/Back to Lounge/}).click()
    await expect(cover).toHaveCount(1)
    // Rapid superseding route requests still leave just one bounded cover.
    await page.evaluate(()=>{location.hash='#/profile'})
    await expect(cover).toHaveCount(1)
    await page.clock.runFor(1600)
    await expect(cover).toHaveCount(0)
    await expect(profile).toBeVisible()
    await page.evaluate(()=>dispatchEvent(new HashChangeEvent('hashchange')))
    await page.clock.runFor(2000)
    await expect(cover).toHaveCount(0)
    await page.getByRole('link',{name:'Lounge',exact:true}).click()
    await page.clock.runFor(1200)
    await page.route('**/api/career?op=profile**',r=>r.fulfill({status:503,json:{error:'Career temporarily unavailable'}}))
    await page.getByRole('link',{name:'My Profile',exact:true}).click()
    await page.clock.runFor(1600)
    await expect(cover).toHaveCount(0)
    await expect(profile.getByRole('status')).toContainText('Career temporarily unavailable')
  })
})

test('local turns, selection and background activity never create a branded cover',async({page})=>{
  const game=auditGame(2,7)
  game.deadline = new Date('2026-11-11T14:02:00Z').getTime()
  await clock(page)
  await page.goto('/#/game')
  await page.evaluate(({game,key})=>sessionStorage.setItem(key,JSON.stringify(game)),{game,key:SESSION_KEY})
  await page.reload()
  const before=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).deadline,SESSION_KEY)
  await expect(page.locator('.startup-screen')).toHaveCount(0)
  await page.locator('.hand-card').first().click()
  await page.clock.runFor(1000)
  await expect(page.locator('.startup-screen')).toHaveCount(0)
  expect(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).deadline,SESSION_KEY)).toBe(before)
})

test('an online game immediately cancels navigation branding and socket updates never restart it',async({page})=>{
  await clock(page)
  const now=await page.evaluate(()=>Date.now()), game=auditGame(2,7)
  const players=game.players.map(p=>({id:p.id,displayName:p.name,avatarUrl:null,accountType:'guest'}))
  const view={phase:game.phase,round:game.round,currentPlayerId:'p0',players:players.map((p,i)=>({...p,cardCount:game.players[i].hand.length,score:0,eliminated:false})),hand:game.players[0].hand,indicator:game.indicator,latestDiscard:game.discards.at(-1),pickup:[],drawCount:game.drawPile.length,deadline:now+60000,penalty:0,openingPenalty:false,canShow:false,result:null,events:game.events,log:game.log}
  const room={id:'room',code:'ABC234',hostId:'p0',settings:{maxPlayers:2,timedGame:true,turnDurationSeconds:60,eliminationThreshold:100},status:'waiting',revision:1,serverNow:now,members:players.map((p,order)=>({...p,order,connected:true,lastSeen:now,disconnectedAt:null,authExpiresAt:now+600000,left:false})),game:null as typeof view|null}
  await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:null}}))
  await page.route('**/api/session',r=>r.fulfill({json:{user:{player:players[0],email:null,createdAt:'2026-11-11',lastActiveAt:'2026-11-11'},room:null}}))
  await page.route('**/api/rooms/ABC234/join',r=>r.fulfill({json:room}))
  await page.route('**/api/rooms/ABC234/ticket',r=>r.fulfill({json:{ticket:'test'}}))
  let send!: (value:unknown)=>void, sockets=0
  await page.routeWebSocket('**/api/rooms/ABC234/ws**',socket=>{sockets++;send=value=>socket.send(JSON.stringify(value));socket.onMessage(()=>{})})
  await ready(page)
  await page.evaluate(()=>{location.hash='#/room/ABC234'})
  await expect(page.locator('.navigation-loading')).toHaveCount(1)
  await expect(page.locator('.connection-live')).toHaveCount(1)
  send({type:'state',room:{...room,status:'in-game',revision:2,game:view}})
  // The virtual clock has not advanced: do not impose the navigation minimum on live play.
  await expect(page.locator('.startup-screen')).toHaveCount(0)
  await expect(page.locator('.hand-card').first()).toBeVisible()
  const mounted=await page.locator('.active-game').elementHandle()
  await page.locator('.hand-card').first().click()
  await page.clock.runFor(1000)
  send({type:'state',room:{...room,status:'in-game',revision:3,serverNow:now+4500,game:view}})
  await expect(page.locator('.startup-screen')).toHaveCount(0)
  expect(await mounted!.evaluate(el=>el===document.querySelector('.active-game'))).toBe(true)
  expect(sockets).toBe(1)
})
