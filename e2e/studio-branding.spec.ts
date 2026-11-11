import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const screenshots = join(tmpdir(), 'least-count-studio-branding')
for (const mobile of [true, false]) test.describe(mobile ? 'mobile studio branding' : 'desktop studio branding', () => {
  test.use({viewport: mobile ? {width:844,height:390} : {width:1280,height:800}, ...(mobile ? {userAgent:iphone,isMobile:true,hasTouch:true} : {})})
  test('approved logo loads with exact gold and alpha, fits screens, and initialization resumes normally', async ({page}) => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {release = resolve})
    await page.route('**/api/config', async route => {
      await gate
      await route.fulfill({json:{service:'least-count',supabase:null}})
    })
    await page.route('**/api/session', route => route.fulfill({json:{user:null,room:null}}))
    await page.goto('/')
    const loading = page.locator('.startup-screen')
    const logo = loading.getByRole('img',{name:'Chavium Games'})
    await expect(logo).toBeVisible()
    await expect(loading.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0')
    const pixels = await logo.evaluate(async (element) => {
      const image = element as HTMLImageElement
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width=image.naturalWidth; canvas.height=image.naturalHeight
      const context=canvas.getContext('2d')!
      context.drawImage(image,0,0)
      const data=context.getImageData(0,0,canvas.width,canvas.height).data
      let opaque=0, transparent=0, wrong=0
      for(let i=0;i<data.length;i+=4){
        if(data[i+3]===0) transparent++
        // Browser premultiplication can round RGB at translucent antialiased edges.
        if(data[i+3]>=250){opaque++;if(Math.abs(data[i]-233)>1 || Math.abs(data[i+1]-205)>1 || Math.abs(data[i+2]-145)>1) wrong++}
      }
      return {opaque,transparent,wrong,width:canvas.width,height:canvas.height}
    })
    expect(pixels).toMatchObject({wrong:0,width:1536,height:1024})
    expect(pixels.transparent).toBeGreaterThan(0)
    expect(pixels.opaque).toBeGreaterThan(0)
    async function fits(selector: string) {
      const outside=await page.locator(selector).evaluate(element=>Array.from(element.querySelectorAll('img,p,small,svg,button,[role=progressbar],h1:not(.visually-hidden)')).filter(node=>{
        const r=node.getBoundingClientRect()
        return r.width && r.height && (r.left<0 || r.top<0 || r.right>innerWidth+1 || r.bottom>innerHeight+1)
      }).map(node=>node.tagName))
      expect(outside).toEqual([])
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    }
    await fits('.startup-screen')
    const bounds=await logo.boundingBox()
    expect(bounds!.width/bounds!.height).toBeCloseTo(1.5,2)
    if(mobile){
      await mkdir(screenshots,{recursive:true})
      await page.screenshot({path:`${screenshots}/loading.png`})
      const main=await page.locator('main').elementHandle()
      await page.setViewportSize({width:390,height:844})
      const guard=page.getByRole('dialog',{name:'Rotate Your Phone'})
      await expect(guard.getByRole('img',{name:'Chavium Games'})).toBeVisible()
      await expect(guard).toContainText('Least Count is designed to be played in landscape mode.')
      await expect(page.locator('.orientation-content')).toBeHidden()
      await fits('.orientation-guard')
      await page.screenshot({path:`${screenshots}/rotate-phone.png`})
      await page.setViewportSize({width:320,height:480})
      await fits('.orientation-guard')
      await page.setViewportSize({width:667,height:320})
      await expect(logo).toBeVisible()
      await fits('.startup-screen')
      expect(await main!.evaluate(node=>node===document.querySelector('main'))).toBe(true)
    } else {
      await page.setViewportSize({width:390,height:844})
      await expect(page.getByRole('dialog',{name:'Rotate Your Phone'})).toHaveCount(0)
      await expect(logo).toBeVisible()
    }
    release()
    await expect(page.getByRole('button',{name:'Continue as Guest',exact:true})).toBeVisible()
    await expect(loading).toHaveCount(0)
  })
})
