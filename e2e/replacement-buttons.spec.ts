import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { auditGame } from './ux-fixture'
import { applyAction, latestGroup, pickupCards, canShow } from '../src/game/engine'
import { createCard } from '../src/game/cards'
import { SESSION_KEY } from '../src/lib/session'

async function appearance(button: Locator) {
  return button.evaluate(element => {
    const s = getComputedStyle(element)
    return [s.backgroundColor,s.color,s.fontSize,s.fontWeight,s.fontFamily,s.borderWidth,s.borderColor,s.borderRadius,s.padding,s.minHeight,s.outlineWidth,s.outlineOffset,s.opacity,s.transform,element.getBoundingClientRect().height]
  })
}
for (const mobile of [false,true]) for (const online of [false,true]) test.describe(`${mobile?'mobile landscape':'desktop'} ${online?'online':'practice'}`,()=>{
  test.use({viewport:mobile?{width:844,height:390}:{width:1440,height:1000},...(mobile?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})})
  test('replacement buttons share gold, metrics and interaction states and retain correct actions',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'})
    let game=auditGame(2)
    game.settings={timedGame:false,eliminationThreshold:100};game.deadline=null
    const eligible={...createCard('clubs','4'),id:'eligible-four'}
    const group=online?[eligible,{...createCard('hearts','4'),id:'second-four'}]:[eligible]
    game.discards=[group];game.eligible=group.map(c=>c.id)
    const outgoing=game.players[0].hand.find(c=>c.rank!=='7'&&c.rank!=='4')!
    game=applyAction(game,{type:'discard',playerId:'p0',cardIds:[outgoing.id]})
    expect(game.phase).toBe('draw')
    const actions: Record<string,unknown>[]=[]
    await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:null}}))
    if(online){
      const players=game.players.map(p=>({id:p.id,displayName:p.name,avatarUrl:null,accountType:'guest'}))
      await page.route('**/api/session',r=>r.fulfill({json:{user:{player:players[0],email:null,createdAt:'2026-11-11',lastActiveAt:'2026-11-11'},room:{id:'room',code:'ABC234'}}}))
      const room={id:'room',code:'ABC234',hostId:'p0',settings:{maxPlayers:2,timedGame:false,turnDurationSeconds:null,eliminationThreshold:100},status:'in-game',revision:1,serverNow:Date.now(),members:players.map((p,order)=>({...p,order,connected:true,lastSeen:Date.now(),disconnectedAt:null,authExpiresAt:Date.now()+600000,left:false})),game:{phase:game.phase,round:game.round,currentPlayerId:'p0',players:players.map((p,i)=>({...p,cardCount:game.players[i].hand.length,score:0,eliminated:false})),hand:game.players[0].hand,indicator:game.indicator,latestDiscard:latestGroup(game),pickup:pickupCards(game),drawCount:game.drawPile.length,deadline:null,penalty:0,openingPenalty:false,canShow:canShow(game,'p0'),result:null,events:game.events,log:game.log}}
      await page.route('**/api/rooms/ABC234/join',r=>r.fulfill({json:room}))
      await page.route('**/api/rooms/ABC234/ticket',r=>r.fulfill({json:{ticket:'test'}}))
      await page.routeWebSocket('**/api/rooms/ABC234/ws**',socket=>{socket.onMessage(data=>{const message=JSON.parse(String(data));actions.push(message);socket.send(JSON.stringify({type:'ack',requestId:message.requestId}))})})
      await page.goto('/#/room/ABC234')
    } else {
      await page.route('**/api/session',r=>r.fulfill({json:{user:null,room:null}}))
      await page.goto('/#/game')
      await page.evaluate(({key,game})=>sessionStorage.setItem(key,JSON.stringify(game)),{key:SESSION_KEY,game})
      await page.reload()
    }
    const draw=page.getByRole('button',{name:'Draw New Card',exact:true})
    const pickup=page.getByRole('button',{name:'Pick up 4 of clubs',exact:true})
    await expect(draw).toBeEnabled();await expect(pickup).toBeEnabled()
    await expect(pickup).toContainText('Pick Up 4♣')
    const panel=page.getByRole('region',{name:'Turn actions'})
    await expect(panel.getByRole('button')).toHaveCount(2)
    await expect(panel.locator('[data-pickup-card]')).toHaveCount(1)
    await expect(page.getByRole('button',{name:/all.*open cards/i})).toHaveCount(0)
    await expect(page.getByRole('dialog',{name:'Choose an open card'})).toHaveCount(0)
    await expect(panel).toHaveCSS('border-top-width','0px')
    await expect(panel).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
    const table=(await page.locator('.live-table').boundingBox())!, rail=(await panel.locator('.game-action-rail').boundingBox())!, status=(await panel.locator('.turn-status').boundingBox())!
    expect(rail.x).toBeGreaterThan(table.x+table.width/2)
    expect(rail.x+rail.width).toBeLessThanOrEqual(table.x+table.width)
    expect(rail.y).toBeGreaterThanOrEqual(table.y)
    expect(rail.y+rail.height).toBeLessThanOrEqual(table.y+table.height)
    expect(status.y).toBeGreaterThanOrEqual(table.y+table.height)
    expect(Math.abs(status.x+status.width/2-table.x-table.width/2)).toBeLessThan(1)
    await expect(panel.locator('.turn-status').getByRole('button')).toHaveCount(0)
    const drawBox=(await draw.boundingBox())!, pickupBox=(await pickup.boundingBox())!
    expect(Math.abs(drawBox.x-pickupBox.x)).toBeLessThan(1)
    expect(pickupBox.y-drawBox.y-drawBox.height).toBeGreaterThanOrEqual(6)
    if(mobile) {
      expect(status.y+status.height).toBeLessThanOrEqual(390)
      expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true)
    }
    await draw.evaluate(el=>(el as HTMLElement).blur())
    expect(await appearance(pickup)).toEqual(await appearance(draw))
    const gold=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--gold').trim())
    expect(gold).toBe('#e9cd91')
    await expect(draw).toHaveCSS('background-color','rgb(233, 205, 145)')
    await expect(pickup.locator(':scope > span').last()).toHaveCSS('font-weight','600')
    await expect(pickup.locator(':scope > span').last()).toHaveCSS('font-size',await draw.evaluate(el=>getComputedStyle(el).fontSize))
    if(!mobile) {
      await expect(pickup.getByRole('img',{name:'4 of clubs'})).toBeVisible()
      await expect(pickup.getByRole('img',{name:'4 of clubs'})).toHaveCSS('font-weight','400')
    }
    const states: unknown[][]=[[],[],[],[]]
    for(const button of [draw,pickup]){
      await button.hover();states[0].push(await appearance(button))
      await page.mouse.down();states[1].push(await appearance(button))
      await page.mouse.move(0,0);await page.mouse.up()
      await page.keyboard.press('Tab');await button.focus();states[2].push(await appearance(button))
      await button.evaluate(el=>{(el as HTMLButtonElement).disabled=true});states[3].push(await appearance(button))
      await button.evaluate(el=>{(el as HTMLButtonElement).disabled=false;(el as HTMLElement).blur()})
    }
    for(const state of states) expect(state[0]).toEqual(state[1])
    if(mobile) expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await pickup.click()
    if(online){
      await expect.poll(()=>JSON.stringify(actions)).toContain('eligible-four')
      actions.length=0
      await draw.click()
      await expect.poll(()=>JSON.stringify(actions)).toContain('pile')
    } else {
      await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).players[0].hand.some((c:{id:string})=>c.id==='eligible-four'),SESSION_KEY)).toBe(true)
      // Restore the same pending choice, then exercise the other action independently.
      await page.evaluate(({key,game})=>sessionStorage.setItem(key,JSON.stringify(game)),{key:SESSION_KEY,game});await page.reload()
      await draw.click()
      await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).players[0].hand.length,SESSION_KEY)).toBe(game.players[0].hand.length+1)
    }
  })
})
