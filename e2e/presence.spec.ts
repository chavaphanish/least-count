import {expect,test} from '@playwright/test'
import type {Page,WebSocketRoute} from '@playwright/test'
import {mock} from './career-fixture'
import {createRoom,join,start,view} from '../server/room'
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function presence(page:Page){
 let enabled=false,ttl=60000
 const calls:{ids:string[];heartbeat:boolean}[]=[]
 await page.route('**/api/presence',route=>{const input=route.request().postDataJSON();calls.push(input);expect(Object.keys(input).sort()).toEqual(['heartbeat','ids']);return route.fulfill({json:{online:enabled?Object.fromEntries(input.ids.filter((id:string)=>[uid,other].includes(id)).map((id:string)=>[id,ttl])):{}}})})
 return{calls,enable:()=>{enabled=true},ttl:(value:number)=>{ttl=value}}
}
for(const [width,height]of [[1280,800],[667,375]])test(`shared online avatars across rankings, buddies and profiles at ${width}`,async({browser})=>{
 test.setTimeout(45000)
 const context=await browser.newContext({viewport:{width,height},...(width<1000?{isMobile:true,hasTouch:true,userAgent:iphone}:{})})
 try{
  const page=await context.newPage(),state=await mock(page),p=await presence(page);state.setRelationship('accepted')
  await page.goto('/');await expect(page.locator('.lounge-home')).toBeVisible();await expect(page.locator('.header-profile .presence-dot')).toHaveCount(0)
  p.enable();await page.getByRole('link',{name:'Leaderboards',exact:true}).click()
  const dot=page.locator('.leaderboard .presence-dot').first();await expect(dot).toBeVisible();await expect(dot).toHaveAttribute('aria-label','Online')
  const geometry=await dot.evaluate(el=>{const a=el.parentElement!.getBoundingClientRect(),d=el.getBoundingClientRect();return{corner:d.x>a.x+a.width/2&&d.y>a.y+a.height/2,overlap:d.right>=a.right-2&&d.bottom>=a.bottom-2,position:getComputedStyle(el).position}})
  expect(geometry).toEqual({corner:true,overlap:true,position:'absolute'})
  await page.getByRole('link',{name:'Buddies',exact:true}).click()
  await expect(page.locator('.circle-list .presence-dot').first()).toBeVisible()
  await page.getByRole('link',{name:'Your profile',exact:true}).click();await expect(page.locator('.career-profile-header .presence-dot')).toBeVisible()
  await page.getByRole('link',{name:'Home',exact:true}).click();await page.getByRole('link',{name:'Leaderboards',exact:true}).click()
  await expect(page.locator('.leaderboard .presence-dot').first()).toBeVisible()
  expect(p.calls.filter(c=>c.heartbeat).length).toBe(1)
  expect(p.calls.every(c=>new Set(c.ids).size===c.ids.length&&c.ids.length<=100)).toBe(true)
 }finally{await context.close()}
})
test('client hides expired status after network failure without a new login event',async({page})=>{
 await mock(page);const p=await presence(page);p.enable();p.ttl(1000)
 await page.goto('/#/leaderboards');const dot=page.locator('.leaderboard .presence-dot').first();await expect(dot).toBeVisible()
 await page.route('**/api/presence',route=>route.abort())
 await expect(page.locator('.leaderboard .presence-dot')).toHaveCount(0,{timeout:5000})
})
test('guest sessions never heartbeat or gain an online badge, but can see registered presence',async({page})=>{
 const state=await mock(page);state.user.player.accountType='guest';const p=await presence(page);p.enable()
 await page.goto('/#/leaderboards');await expect(page.locator('.leaderboard .presence-dot').first()).toBeVisible();await expect(page.locator('.header-profile .presence-dot')).toHaveCount(0)
 expect(p.calls.length).toBeGreaterThan(0);expect(p.calls.every(c=>!c.heartbeat)).toBe(true)
})
test('one app-level heartbeat continues at 30 seconds and stops after sign out',async({page})=>{
 const state=await mock(page),p=await presence(page);p.enable();let signedOut=false
 await page.route('**/api/logout',route=>{signedOut=true;return route.fulfill({json:{ok:true}})})
 await page.route('**/api/session',route=>route.fulfill({json:{user:signedOut?null:state.user,room:null}}))
 await page.clock.install();await page.goto('/#/settings');await expect(page.locator('.startup-screen')).not.toBeVisible();await expect(page.locator('.header-profile .presence-dot')).toBeVisible()
 const before=p.calls.filter(c=>c.heartbeat).length;await page.clock.fastForward(30000)
 await expect.poll(()=>p.calls.filter(c=>c.heartbeat).length).toBe(before+1)
 await page.getByRole('button',{name:'Sign Out',exact:true}).click();await expect(page.getByRole('button',{name:'Login as Guest',exact:true})).toBeVisible()
 const after=p.calls.filter(c=>c.heartbeat).length;await page.clock.fastForward(60000);expect(p.calls.filter(c=>c.heartbeat).length).toBe(after)
})
test('registered room avatars share presence in the lobby and during gameplay; guests stay unmarked',async({page})=>{
 const state=await mock(page),p=await presence(page);p.enable();const now=Date.now()
 const own={...state.user.player,accountType:'registered' as const,expiresAt:now+3600000},friend={...state.friend,id:`user:${other}`,accountType:'registered' as const,expiresAt:now+3600000},guest={id:'guest:one',displayName:'Guest',avatarUrl:null,accountType:'guest' as const,expiresAt:now+3600000}
 const room=createRoom('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ABC234',own,{maxPlayers:3,eliminationThreshold:100,timedGame:false},now);join(room,friend,now);join(room,guest,now);room.members.forEach(m=>{m.connected=true;m.disconnectedAt=null;m.lastSeen=now})
 await page.route('**/api/rooms/ABC234/join',route=>route.fulfill({json:view(room,own.id,Date.now())}));await page.route('**/api/rooms/ABC234/ticket',route=>route.fulfill({json:{ticket:'test'}}))
 let socket:WebSocketRoute|undefined
 await page.routeWebSocket('**/api/rooms/ABC234/ws**',ws=>{socket=ws;ws.onMessage(raw=>{if(JSON.parse(String(raw)).type==='ping')ws.send(JSON.stringify({type:'pong',serverNow:Date.now()}))})})
 await page.goto('/#/room/ABC234');await expect(page.locator('.lobby-grid .presence-dot')).toHaveCount(2)
 start(room,own.id,Date.now(),()=>.6);room.revision++;socket!.send(JSON.stringify({type:'state',room:view(room,own.id,Date.now())}))
 await expect(page.locator('.live-opponent .presence-dot')).toHaveCount(1);await expect(page.locator('.hand-player .presence-dot')).toHaveCount(1)
 expect(p.calls.flatMap(c=>c.ids)).not.toContain('guest:one')
})
