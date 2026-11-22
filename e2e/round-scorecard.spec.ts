import { test, expect } from '@playwright/test'
import { auditGame } from './ux-fixture'
import { mock } from './career-fixture'
import { SESSION_KEY } from '../src/lib/session'

test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' })
test('all eight scores and both round actions fit iPhone landscape', async ({page}) => {
  await mock(page)
  const game = auditGame(8)
  game.phase = 'round-over'
  game.deadline = null
  game.result = { reason: 'show', successful: true, caller: 'p0', winners: ['p0'],
    scores: game.players.map(p => ({...p, total: 7, penalty: 0})) }
  await page.addInitScript(({key, game}) => sessionStorage.setItem(key, JSON.stringify(game)), {key: SESSION_KEY, game})
  await page.goto('/#/game')
  const panel = page.locator('.round-summary')
  await expect(panel.getByRole('heading')).toContainText('declared a least count of 7 and won the round!')
  await expect(panel.locator('tbody tr:visible')).toHaveCount(8)
  for (const control of await panel.locator('tbody tr,button:visible').all()) await expect(control).toBeInViewport({ratio: 1})
  await panel.getByRole('button', {name:'Quit Game',exact:true}).click()
  const confirm = page.getByRole('dialog',{name:'Quit Game?'})
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button',{name:'Cancel'}).click()
  await expect(panel).toBeVisible()
})

for (const count of [2,8]) for (const final of [false,true]) {
  test(`ordered hands fit for ${count} players at ${final ? 'game' : 'round'} completion`,async({page})=>{
    await mock(page)
    const game=auditGame(count,15)
    const expected=game.players.map(p=>p.hand.map(card=>card.rank==='PJ'?'Printed Joker':`${card.rank} of ${card.suit}`))
    game.phase=final?'game-over':'round-over'
    game.deadline=null
    game.result={reason:'last-player',winners:['p0'],scores:[]}
    if(final) for (const player of game.players.slice(1)) {
      player.eliminated=true
      player.terminalHand=player.hand
      player.hand=[]
    }
    await page.addInitScript(({key,game})=>sessionStorage.setItem(key,JSON.stringify(game)),{key:SESSION_KEY,game})
    await page.goto('/#/game')
    const panel=page.locator('.round-summary')
    await expect(panel.getByRole('columnheader',{name:'Hand',exact:true})).toBeVisible()
    for(let i=0;i<count;i++){
      const cards=panel.locator('tbody tr').nth(i).locator('.score-hand .playing-card')
      expect(await cards.evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')))).toEqual(expected[i])
      await expect(cards.last()).toBeInViewport({ratio:1})
    }
    expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1 && el.scrollHeight<=el.clientHeight+1)).toBe(true)
  })
}
