import { test, expect } from '@playwright/test'
import { applyAction } from '../src/game/engine'
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

for (const viewport of [{width:844,height:390}, {width:667,height:320}, {width:1024,height:768}, {width:1440,height:900}]) {
  test.describe(`round results at ${viewport.width}×${viewport.height}`, () => {
    test.use({viewport, ...(viewport.width === 1440 ? {isMobile:false,hasTouch:false,userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/146.0.0.0 Safari/537.36'} : {})})
    for (const count of viewport.width === 844 ? [2, 4, 6, 8] : [8]) for (const successful of [true, false]) {
      test(`${count} players fit after a ${successful ? 'successful' : 'failed'} Least declaration`, async ({page}) => {
        await mock(page)
        const game = auditGame(count, 15)
        game.phase = 'round-over'
        game.deadline = null
        game.result = {reason: 'show', caller: 'p0', successful, winners: [successful ? 'p0' : 'p1'],
          scores: game.players.map(p => ({...p, total: 7, penalty: 0}))}
        await page.addInitScript(({key, game}) => sessionStorage.setItem(key, JSON.stringify(game)), {key: SESSION_KEY, game})
        await page.goto('/#/game')
        const panel = page.locator('[data-round-results]')
        await expect(panel.getByRole('heading')).toContainText(successful ? 'won the round!' : 'failed!')
        const rows = panel.locator('tbody tr')
        await expect(rows).toHaveCount(count)
        for (const [index, player] of game.players.entries()) {
          const cards = rows.nth(index).locator('.score-hand .playing-card')
          await expect(cards).toHaveCount(player.hand.length)
          await expect(cards.last()).toBeInViewport({ratio: 1})
        }
        const header = (await panel.locator('.result-intro').boundingBox())!
        const table = (await panel.locator('table').boundingBox())!
        const start = panel.getByRole('button', {name: 'Start Round 2'})
        const startBox = (await start.boundingBox())!
        const quitBox = (await panel.getByRole('button', {name: 'Quit Game', exact:true}).boundingBox())!
        expect(header.y + header.height).toBeLessThanOrEqual(table.y + 1)
        expect(table.y + table.height).toBeLessThanOrEqual(startBox.y + 1)
        expect(startBox.width).toBeCloseTo(quitBox.width, 0)
        expect(startBox.y).toBe(quitBox.y)
        expect(startBox.x).toBeCloseTo(table.x, 0)
        expect(quitBox.x + quitBox.width).toBeCloseTo(table.x + table.width, 0)
        expect(await panel.evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        await expect(start).toBeInViewport({ratio: 1})
        await start.click()
        await expect(page.locator('.mobile-game-bar')).toContainText('Round 2')
      })
    }

  })
}

for (const count of [2,8]) for (const final of [false,true]) {
  test(`ordered hands fit for ${count} players at ${final ? 'game' : 'round'} completion`,async({page})=>{
    await mock(page)
    const game=auditGame(count,15)
    const firstHand = game.players[0].hand
    const source = [game.drawPile, ...game.players.map(p => p.hand)].find(cards => cards.some(card => card.rank === 'PJ'))!
    const jokerIndex = source.findIndex(card => card.rank === 'PJ')
    const last = firstHand.length - 1
    ;[source[jokerIndex], firstHand[last]] = [firstHand[last], source[jokerIndex]]
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
    const hand = panel.locator('.score-hand').first()
    const joker = hand.locator('.printed-joker').last()
    const regular = hand.locator('.playing-card:not(.printed-joker)').first()
    const jokerBox = (await joker.boundingBox())!
    const regularBox = (await regular.boundingBox())!
    expect(jokerBox.width).toBeCloseTo(regularBox.width, 1)
    expect(jokerBox.height).toBeCloseTo(regularBox.height, 1)
    const art = (await joker.locator('.jester-art').boundingBox())!
    const pipSize = await regular.locator('.card-pip').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    expect(art.height).toBeGreaterThan(0)
    expect(art.height).toBeLessThanOrEqual(pipSize)
    for(let i=0;i<count;i++){
      const cards=panel.locator('tbody tr').nth(i).locator('.score-hand .playing-card')
      expect(await cards.evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')))).toEqual(expected[i])
      await expect(cards.last()).toBeInViewport({ratio:1})
    }
    expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1 && el.scrollHeight<=el.clientHeight+1)).toBe(true)
  })
}

test('names the winning bot when the human forfeits a two-player round', async ({page}) => {
  await mock(page)
  const playing = auditGame(2)
  const game = applyAction(playing, {type: 'timeout'}, playing.deadline!)
  await page.addInitScript(({key, game}) => sessionStorage.setItem(key, JSON.stringify(game)), {key: SESSION_KEY, game})
  await page.goto('/#/game')
  await expect(page.locator('.round-summary').getByRole('heading')).toHaveText('Alex wins this round')
})
