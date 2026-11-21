import {test,expect} from '@playwright/test'
import {mock} from './career-fixture'
import {buildLesson} from '../src/tutorial/lesson'

for (const mobile of [false,true]) {
  test.describe(mobile ? 'iPhone 13 landscape' : 'desktop', () => {
    test.use(mobile ? {isMobile:true,hasTouch:true,viewport:{width:844,height:390},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'} : {viewport:{width:1280,height:800}})
    test('plays, replays, skips and exits the isolated tutorial', async ({page})=>{
      test.setTimeout(90000)
      await mock(page)
      await page.goto('/')
      await page.getByRole('link',{name:'Tutorial',exact:true}).click()
      const lesson = page.getByRole('region',{name:'YAYDU tutorial'})
      for (const f of buildLesson()) {
        await expect(lesson.getByText(f.text,{exact:true})).toBeVisible()
        if (f.step === 2 && f.input === 'next') {
          await lesson.getByRole('button',{name:'Back',exact:true}).click()
          await lesson.getByRole('button',{name:'Next',exact:true}).click()
          await lesson.getByRole('button',{name:'Next',exact:true}).click()
          await lesson.getByRole('button',{name:'Replay step'}).click()
        }
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight)).toBe(true)
        for(const control of await lesson.locator('button:enabled,a').all()) await expect(control).toBeInViewport()
        if(f.input==='drop') {
          for (const id of f.ids) await page.locator('[data-hand-card="'+id+'"]').click()
          await lesson.getByRole('button',{name:f.game.phase==='penalty'?'Play 7':'Drop Selected Cards',exact:true}).click()
        } else {
          const buttons={next:'Next',draw:'Draw Pile',pickup:'Pick Up 5',declare:'Declare Least',ready:'Next Round',finish:'Play Again'}
          if(f.input!=='watch' && f.input!=='timer') await lesson.getByRole('button',{name:new RegExp(buttons[f.input]+'$')}).click()
        }
      }
      await expect(lesson.getByText('Step 1 of 11 · Tutorial')).toBeVisible()
      await lesson.getByRole('button',{name:'Skip Tutorial'}).click()
      await lesson.getByRole('link',{name:'Return to Lounge'}).click()
      await expect(page.getByRole('link',{name:'Tutorial',exact:true})).toBeVisible()
    })
  })
}
