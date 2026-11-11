import { expect,test } from '@playwright/test'
import type { Page,WebSocketRoute } from '@playwright/test'
import { auditGame } from './ux-fixture'
import { SESSION_KEY } from '../src/lib/session'
const android='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'
async function harness(page:Page,vibration=true){
 await page.addInitScript(({vibration})=>{
  const trace:Record<string,unknown>[]=[];(window as unknown as {feedbackTrace:typeof trace}).feedbackTrace=trace
  if(vibration)Object.defineProperty(navigator,'vibrate',{configurable:true,value:(pattern:number|number[])=>{trace.push({kind:'vibrate',pattern});return true}})
  else Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined})
  const Native=window.AudioContext
  class ObservedContext extends Native {
   constructor(){super();trace.push({kind:'context'})}
   async decodeAudioData(buffer:ArrayBuffer){const decoded=await super.decodeAudioData(buffer);trace.push({kind:'decode',duration:decoded.duration});return decoded}
   createBufferSource(){
    const source=super.createBufferSource(),start=source.start.bind(source),stop=source.stop.bind(source)
    source.start=(...args:Parameters<typeof source.start>)=>{trace.push({kind:'start',duration:source.buffer?.duration,loop:source.loop});start(...args)}
    source.stop=(...args:Parameters<typeof source.stop>)=>{trace.push({kind:'stop',duration:source.buffer?.duration,loop:source.loop});stop(...args)}
    return source
   }
  }
  window.AudioContext=ObservedContext
 },{vibration})
}
const traces=(page:Page)=>page.evaluate(()=>(window as unknown as {feedbackTrace:Record<string,unknown>[]}).feedbackTrace)
async function clock(page:Page){const now=new Date('2026-11-11T16:00:00Z');await page.clock.install({time:now});await page.clock.pauseAt(new Date(now.getTime()+60000))}
async function backend(page:Page){
 const game=auditGame(2,7),players=game.players.map(p=>({id:p.id,displayName:p.name,avatarUrl:null,accountType:'guest'})),now=await page.evaluate(()=>Date.now())
 const view={phase:'turn',round:1,currentPlayerId:'p1',players:players.map((p,i)=>({...p,cardCount:game.players[i].hand.length,score:0,eliminated:false})),hand:game.players[0].hand,indicator:game.indicator,latestDiscard:game.discards.at(-1)!,pickup:[],drawCount:game.drawPile.length,deadline:now+60000,penalty:0,openingPenalty:false,canShow:false,result:null,events:[{id:'event-1',sequenceNumber:1,roundNumber:1,timestamp:now-10000,type:'ROUND_STARTED'}],log:[]}
 const room={id:'sound-room',code:'ABC234',hostId:'p0',settings:{maxPlayers:2,timedGame:true,turnDurationSeconds:60,eliminationThreshold:100},status:'in-game',revision:1,serverNow:now,members:players.map((p,order)=>({...p,order,connected:true,lastSeen:now,disconnectedAt:null,authExpiresAt:now+600000,left:false})),game:view}
 await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:null}}))
 await page.route('**/api/session',r=>r.fulfill({json:{user:{player:players[0],email:null,createdAt:'2026-11-11',lastActiveAt:'2026-11-11'},room:null}}))
 await page.route('**/api/rooms/ABC234/join',r=>r.fulfill({json:room}));await page.route('**/api/rooms/ABC234/ticket',r=>r.fulfill({json:{ticket:'test'}}))
 const sockets:WebSocketRoute[]=[]
 await page.routeWebSocket('**/api/rooms/ABC234/ws**',socket=>{sockets.push(socket);socket.onMessage(()=>{})})
 return {room,view,sockets,now}
}
for(const mobile of [false,true])test.describe(mobile?'Android feedback':'desktop feedback',()=>{
 test.use({viewport:mobile?{width:667,height:320}:{width:1440,height:900},...(mobile?{userAgent:android,isMobile:true,hasTouch:true}:{})})
 test('settings default independently, persist, and unsupported vibration is clear',async({page})=>{
  await harness(page,mobile);await clock(page);await backend(page);await page.goto('/');await expect(page.locator('.startup-screen')).toHaveAttribute('data-ready','true');await page.clock.runFor(3500)
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.clock.runFor(1600)
  const settings=page.getByRole('group',{name:'Sound & Haptics'})
  await expect(settings.getByLabel('Sound Effects',{exact:true})).toBeChecked();await expect(settings.getByLabel('Turn Notifications',{exact:true})).toBeChecked()
  if(mobile)await expect(settings.getByLabel('Vibration',{exact:true})).toBeChecked()
  else await expect(settings.getByLabel('Vibration',{exact:true})).toBeDisabled()
  await settings.getByLabel('Sound Effects',{exact:true}).uncheck();await settings.getByLabel('Turn Notifications',{exact:true}).uncheck()
  if(mobile)await settings.getByLabel('Vibration',{exact:true}).uncheck()
  const before=await page.evaluate(()=>localStorage.getItem('least-count:feedback:v1'))
  await page.reload();await expect(page.locator('.startup-screen')).toHaveAttribute('data-ready','true');await page.clock.runFor(3500);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.clock.runFor(1600)
  expect(await page.evaluate(()=>localStorage.getItem('least-count:feedback:v1'))).toBe(before)
  await expect(settings.getByLabel('Sound Effects',{exact:true})).not.toBeChecked();await expect(settings.getByLabel('Turn Notifications',{exact:true})).not.toBeChecked()
  const outside=await settings.evaluate(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.bottom>innerHeight})
  if(mobile)expect(outside).toBe(false)
  else await expect(settings).toBeVisible()
 })
 for(const final of [false,true])test(`real decoded audio and mobile-only turn haptics follow confirmed turns, warnings and ${final?'game':'round'} results once`,async({page})=>{
  await harness(page,true);await clock(page);const {room,view,sockets,now}=await backend(page)
  await page.goto('/#/room/ABC234');await expect(page.locator('.connection-live')).toHaveCount(1)
  expect((await traces(page)).filter(t=>t.kind==='start')).toHaveLength(0)
  // A trusted interaction unlocks audio; all nine assets decode once and are cached.
  await page.mouse.click(2,180)
  await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='decode').length).toBe(9)
  const turn={...view,currentPlayerId:'p0',deadline:now+20000,events:[...view.events,{id:'event-2',sequenceNumber:2,roundNumber:1,timestamp:now,type:'POWER_SEVEN_CYCLE_COMPLETED',next:{id:'p0',name:'You'}}]}
  sockets.at(-1)!.send(JSON.stringify({type:'state',room:{...room,revision:2,game:turn}}))
  await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='start'&&Math.abs(Number(t.duration)-.8)<.05).length).toBe(1)
  sockets.at(-1)!.send(JSON.stringify({type:'state',room:{...room,revision:3,game:turn}}));await page.clock.runFor(500)
  expect((await traces(page)).filter(t=>t.kind==='vibrate'&&t.pattern===150)).toHaveLength(mobile?1:0)
  // Native Web Audio uses real time, independently of Playwright's virtual JS clock.
  await page.waitForTimeout(900)
  await page.clock.runFor(5000)
  await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='start'&&t.loop===true).length).toBe(1)
  await page.clock.runFor(1000)
  expect((await traces(page)).filter(t=>t.kind==='start'&&t.loop===true)).toHaveLength(1)
  const done={...turn,phase:final?'game-over':'round-over',deadline:null,result:{reason:'exhaustion',winners:[],scores:[]},events:[...turn.events,{id:'event-3',sequenceNumber:3,roundNumber:1,timestamp:now+6500,type:'ROUND_COMPLETED',reason:'exhaustion',scores:[]},...(final?[{id:'event-4',sequenceNumber:4,roundNumber:1,timestamp:now+6500,type:'GAME_COMPLETED',winner:{id:'p0',name:'You'}}]:[])]}
  sockets.at(-1)!.send(JSON.stringify({type:'state',room:{...room,revision:4,serverNow:now+6500,game:done}}))
  await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='start'&&Math.abs(Number(t.duration)-(final?5:3))<.05).length).toBe(1)
  sockets.at(-1)!.send(JSON.stringify({type:'state',room:{...room,revision:5,serverNow:now+6500,game:done}}))
  await page.clock.runFor(300)
  const after=await traces(page)
  expect(after.filter(t=>t.kind==='start'&&Math.abs(Number(t.duration)-(final?3:5))<.05)).toHaveLength(0)
  expect(after.filter(t=>t.kind==='stop'&&t.loop===true)).toHaveLength(1)
  expect(after.filter(t=>t.kind==='vibrate'&&JSON.stringify(t.pattern)===(final?'[150,120,150,120,150]':'[150,120,150]'))).toHaveLength(mobile?1:0)
  const count=after.filter(t=>t.kind==='start').length
  await page.reload();await expect(page.locator('.connection-live')).toHaveCount(1)
  expect((await traces(page)).filter(t=>t.kind==='start')).toHaveLength(0)
  expect(count).toBeGreaterThan(1)
 })
})

test('local dealing and confirmed card flights produce cues; invalid selection does not',async({page})=>{
 await harness(page,false);await page.goto('/#/game');await page.getByRole('button',{name:/Start local game/}).click()
 await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='decode').length).toBe(9)
 await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='start').length).toBeGreaterThan(0)
 const game=auditGame(2,7);game.settings={timedGame:false,eliminationThreshold:100};game.deadline=null
 await page.evaluate(({key,game})=>sessionStorage.setItem(key,JSON.stringify(game)),{key:SESSION_KEY,game});await page.reload()
 await page.locator('.hand-card').first().click();await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='decode').length).toBe(9)
 const selected=(await traces(page)).filter(t=>t.kind==='start').length
 expect(selected).toBe(0)
 await page.locator('[data-plan-discard]').click()
 await expect.poll(async()=>(await traces(page)).filter(t=>t.kind==='start').length).toBeGreaterThan(selected)
})

test('unsupported audio and vibration APIs leave local gameplay functional',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined})})
 await page.goto('/#/game');await page.getByRole('button',{name:/Start local game/}).click()
 await expect(page.getByRole('heading',{name:'Your hand',exact:true})).toBeVisible()
 expect(errors).toEqual([])
})
