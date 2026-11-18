import {expect,test} from '@playwright/test'
import {mock} from './career-fixture'
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function proportions(root: import('@playwright/test').Locator) {
  await expect(root.locator('.brand-tagline')).toHaveCount(0)
  await expect(root.getByText('Powered by',{exact:true})).toBeVisible()
  const geometry=await root.locator('.dual-brand').evaluate(el=>{
    const logo=el.querySelector('.loading-logo img')!.getBoundingClientRect(),word=el.querySelector('.yaydu-wordmark')!.getBoundingClientRect(),studio=el.querySelector('.chavium-logo')!.getBoundingClientRect(),powered=el.querySelector('.powered-by')!.getBoundingClientRect()
    const left={top:logo.y+logo.height*122/1024,bottom:word.bottom},right={top:powered.top,bottom:studio.y+studio.height*990/1024}
    return {ratio:(left.bottom-left.top)/(right.bottom-right.top),centers:Math.abs((left.top+left.bottom-right.top-right.bottom)/2),outside:[logo,word,studio,powered].some(r=>r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)}
  })
  expect(geometry.ratio).toBeGreaterThan(.9);expect(geometry.ratio).toBeLessThan(1.1)
  expect(geometry.centers).toBeLessThan(12);expect(geometry.outside).toBe(false)
}
for(const[width,height]of[[1280,800],[667,320],[480,320]])test(`dual-brand loading, transition and rotation compositions balance at ${width}`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},...(width<1000?{isMobile:true,hasTouch:true,userAgent:iphone}:{})})
  try{
    const page=await context.newPage();await mock(page)
    await page.clock.install({time:new Date('2026-11-18T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-18T12:01:00Z'))
    await page.goto('/');const loading=page.locator('.startup-screen');await expect(loading).toHaveAttribute('data-ready','true');await proportions(loading)
    if(width===667)await page.screenshot({path:'/tmp/yaydu-shared-branding-loading-667.png'})
    await page.clock.runFor(3500);await expect(loading).toHaveCount(0)
    const homeFits=await page.locator('.lounge-home').evaluate(el=>[...el.querySelectorAll('button,a')].every(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}))
    expect(homeFits).toBe(true)
    await page.getByRole('link',{name:'Settings',exact:true}).click()
    const transition=page.locator('.navigation-loading');await expect(transition).toBeVisible();await proportions(transition);await page.clock.runFor(1600)
    if(width<1000){
      await page.setViewportSize({width:320,height:480});const guard=page.getByRole('dialog',{name:'Rotate Your Phone'});await expect(guard).toBeVisible();await proportions(guard)
      if(width===667)await page.screenshot({path:'/tmp/yaydu-shared-branding-rotation.png'})
    }
  }finally{await context.close()}
})
