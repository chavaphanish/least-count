import { expect, test } from '@playwright/test'
import { auditGame } from './ux-fixture'
import { SESSION_KEY } from '../src/lib/session'

for (const viewport of [{width:667,height:320},{width:844,height:390},{width:1440,height:1000}]) test.describe(`gameplay ${viewport.width}`,()=>{
  const mobile=viewport.width<1000
  test.use({viewport,...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',isMobile:true,hasTouch:true}:{})})
  for(const count of [7,15,25]) test(`${count} cards stay selectable in one bounded row beside golden actions`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'})
    const game=auditGame(8,count)
    game.settings={timedGame:false,eliminationThreshold:100};game.deadline=null
    await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:null}}))
    await page.route('**/api/session',r=>r.fulfill({json:{user:null,room:null}}))
    await page.goto('/#/game')
    await page.evaluate(({key,game})=>sessionStorage.setItem(key,JSON.stringify(game)),{key:SESSION_KEY,game})
    await page.reload()
    const hand=page.getByRole('group',{name:'Your hand',exact:true}), cards=hand.locator('.hand-card')
    await expect(cards).toHaveCount(count)
    await expect(hand).toHaveAttribute('data-rows','1')
    await expect.poll(()=>cards.first().evaluate(el=>parseFloat((el as HTMLElement).style.getPropertyValue('--card-width')))).toBeGreaterThan(30)
    const boxes=await cards.evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}))
    expect(new Set(boxes.map(b=>Math.round(b.y))).size).toBe(1)
    const table=(await page.locator('.live-table').boundingBox())!, handBox=(await hand.boundingBox())!, railBox=(await page.locator('.game-action-rail').boundingBox())!
    const status=(await page.locator('.turn-status').boundingBox())!
    expect(status.y).toBeGreaterThanOrEqual(table.y+table.height)
    expect(Math.abs(status.x+status.width/2-table.x-table.width/2)).toBeLessThan(1)
    await expect(page.locator('.turn-status')).toContainText('YOUR TURN')
    await expect(page.locator('.turn-status button')).toHaveCount(0)
    expect(railBox.x).toBeGreaterThanOrEqual(handBox.x+handBox.width)
    for(const box of boxes){
      expect(box.width).toBeGreaterThan(0)
      expect(box.x).toBeGreaterThanOrEqual(handBox.x-1)
      expect(box.x+box.width).toBeLessThanOrEqual(handBox.x+handBox.width+1)
      expect(box.y+box.height).toBeLessThanOrEqual(handBox.y+handBox.height+1)
    }
    const corners=await cards.evaluateAll(elements=>elements.map(el=>{
      const corner=el.querySelector('.card-corner,.joker-corner')!
      return {right:corner.getBoundingClientRect().right,hitRight:el.getBoundingClientRect().right,font:parseFloat(getComputedStyle(corner).fontSize)}
    }))
    for(const corner of corners){expect(corner.right).toBeLessThanOrEqual(corner.hitRight+1);expect(corner.font).toBeGreaterThanOrEqual(11)}
    expect(status.y+status.height).toBeLessThanOrEqual(viewport.height)
    const cardImages=await cards.locator(':scope > .playing-card').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {right:r.right,bottom:r.bottom}}))
    expect(Math.max(...cardImages.map(b=>b.right))).toBeLessThanOrEqual(railBox.x)
    const seats=await page.locator('.live-opponent').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
    const piles=await page.locator('.live-piles .playing-card:visible').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
    for(const pile of piles) {
      expect(pile.right).toBeLessThanOrEqual(railBox.x)
      expect(pile.bottom).toBeLessThanOrEqual(handBox.y)
      for(const seat of seats) expect(pile.right<=seat.x||pile.x>=seat.right||pile.bottom<=seat.y||pile.y>=seat.bottom).toBe(true)
    }
    // Every exposed strip, including the middle and far end of a dense hand, remains selectable.
    for(const index of [0,Math.floor(count/2),count-1]){
      await cards.nth(index).click()
      await expect(cards.nth(index)).toHaveAttribute('aria-pressed','true')
      await page.getByRole('button',{name:'Clear selection',exact:true}).click()
    }
    await cards.first().click()
    const actions=page.locator('.game-action-rail .game-action')
    const metrics=await actions.evaluateAll(buttons=>buttons.map(button=>{const s=getComputedStyle(button),r=button.getBoundingClientRect();return [s.backgroundColor,s.color,s.fontWeight,s.fontSize,s.padding,s.borderWidth,s.borderRadius,r.width,r.height]}))
    for(const metric of metrics) expect(metric).toEqual(metrics[0])
    expect(metrics[0][0]).toBe('rgb(233, 205, 145)')
    const actionBoxes=await actions.evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
    for(let i=0;i<actionBoxes.length;i++){
      expect(actionBoxes[i].x).toBeGreaterThanOrEqual(railBox.x)
      expect(actionBoxes[i].right).toBeLessThanOrEqual(table.x+table.width)
      expect(actionBoxes[i].y).toBeGreaterThanOrEqual(table.y)
      expect(actionBoxes[i].bottom).toBeLessThanOrEqual(table.y+table.height)
      if(i) expect(actionBoxes[i].y).toBeGreaterThanOrEqual(actionBoxes[i-1].bottom+5)
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    if(mobile){
      expect(status.y+status.height).toBeLessThanOrEqual(viewport.height)
      expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true)
    }
    await expect(page.getByRole('button',{name:/all.*open cards/i})).toHaveCount(0)
    if(count===25 && viewport.width!==844) await page.screenshot({path:`/tmp/right-actions-${viewport.width}.png`})
  })
})
