import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'
import { createGame, canShow, latestGroup, pickupCards } from '../src/game/engine'
import type { RoomView } from '../src/shared/multiplayer'

for (const mobile of [false,true]) test.describe(mobile ? 'mobile landscape identity' : 'desktop identity',()=>{
  test.use({viewport:mobile ? {width:667,height:375} : {width:1440,height:900}, ...(mobile ? {isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'} : {})})
  test('names and usernames appear across Lounge, profiles, ranking, buddies, history and the table',async({page})=>{
    const fixture=await mock(page)
    const fields={username:'cardmaster99',firstName:'John',lastName:'Smith'}
    Object.assign(fixture.user.player,fields)
    Object.assign(fixture.me,fields)
    Object.assign(fixture.friend,{username:'otherplayer99',firstName:'Élodie',lastName:'O’Neill'})
    for (const p of fixture.game.players) Object.assign(p,p.id===fixture.user.player.id ? fields : {username:'otherplayer99',firstName:'Élodie',lastName:'O’Neill'})
    for (const p of fixture.game.rounds[0].scores) Object.assign(p,p.id===fixture.user.player.id ? fields : {username:'otherplayer99',firstName:'Élodie',lastName:'O’Neill'})
    fixture.setRelationship('incoming')
    await page.goto('/')
    await expect(page.locator('.dashboard-heading .identity-primary').first()).toHaveText('John Smith')
    await expect(page.locator('.dashboard-heading .identity-username').first()).toHaveText('@cardmaster99')
    if(mobile) await page.getByRole('button',{name:'Leaderboards',exact:true}).click()
    await expect(page.locator('.ranking-list .player-identity').first()).toContainText('Élodie O’Neill')
    await expect(page.locator('.ranking-list .player-identity').first()).toContainText('@otherplayer99')
    await page.goto('/#/profile')
    await expect(page.locator('.career-profile-header .identity-primary')).toHaveText('John Smith')
    await expect(page.locator('.career-profile-header .identity-username')).toHaveText('@cardmaster99')
    await page.goto('/#/player/otherplayer99')
    await expect(page.locator('.career-profile-header .identity-primary')).toHaveText('Élodie O’Neill')
    await expect(page.getByText('owner-private@example.test')).toHaveCount(0)
    await page.goto('/')
    if(mobile) await page.getByRole('button',{name:'Buddies',exact:true}).click()
    else { await page.goto('/#/profile'); await page.getByRole('button',{name:'Buddies',exact:true}).click() }
    await expect(page.locator('.social-list .player-identity').first()).toContainText('Élodie O’Neill')
    await page.goto(`/#/history/${fixture.game.id}`)
    await expect(page.locator('.player-identity').filter({hasText:'John Smith'}).first()).toContainText('@cardmaster99')
    const host={...fixture.user.player,accountType:'registered' as const}
    const opponent={...fixture.friend,id:`user:${fixture.friend.id}`,accountType:'registered' as const}
    const now=Date.now()
    const snapshot: RoomView = {id:'test-room',code:'ABC234',hostId:host.id,settings:{maxPlayers:2,timedGame:false,turnDurationSeconds:null,eliminationThreshold:100},status:'waiting',members:[host,opponent].map((p,order)=>({...p,order,connected:true,lastSeen:now,disconnectedAt:null,authExpiresAt:now+60000,left:false})),revision:1,serverNow:now,game:null}
    await page.route('**/api/rooms/ABC234/join',r=>r.fulfill({json:snapshot}))
    await page.route('**/api/rooms/ABC234/ticket',r=>r.fulfill({json:{ticket:'mock'}}))
    await page.routeWebSocket('**/api/rooms/ABC234/ws?**',ws=>{ ws.onMessage(()=>{}) })
    await page.goto('/#/room/ABC234')
    await expect(page.locator('.lobby-player .player-identity').first()).toContainText('John Smith')
    await expect(page.locator('.lobby-player .player-identity').nth(1)).toContainText('@otherplayer99')
    const game=createGame(['John Smith (@cardmaster99)','Élodie O’Neill (@otherplayer99)'],now,()=>0.5,{timedGame:false,eliminationThreshold:100},[host.id,opponent.id])
    snapshot.status='in-game'
    snapshot.game={phase:game.phase,round:game.round,currentPlayerId:game.players[game.current].id,players:[host,opponent].map((p,i)=>({...p,cardCount:game.players[i].hand.length,score:0,eliminated:false})),hand:game.players[0].hand,indicator:game.indicator,latestDiscard:latestGroup(game),pickup:pickupCards(game),drawCount:game.drawPile.length,deadline:null,penalty:game.sevens?.amount??0,openingPenalty:game.sevens?.opening===true,canShow:canShow(game,host.id),result:null,events:game.events??[],log:game.log}
    await page.reload()
    await expect(page.locator('.live-opponent .player-identity').first()).toContainText('Élodie O’Neill')
    await expect(page.locator('.hand-player .player-identity')).toContainText('@cardmaster99')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    if(mobile){
      const seat=page.locator('.live-opponent').first()
      const bounds=await seat.boundingBox()
      expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(375)
      await seat.click()
      await expect(page.locator('.opponent-detail .player-identity')).toContainText('Élodie O’Neill')
      await expect(page.locator('.opponent-detail .player-identity')).toContainText('@otherplayer99')
    }
    await page.goto('/#/game')
    await page.getByRole('button',{name:/Start local game/}).click()
    await expect(page.locator('.hand-player .player-identity')).toContainText('John Smith')
    await expect(page.locator('.hand-player .player-identity')).toContainText('@cardmaster99')

  })
})
