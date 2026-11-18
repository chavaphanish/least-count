import {expect,test} from '@playwright/test'
import {mock} from './career-fixture'
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function proportions(root: import('@playwright/test').Locator) {
  await expect(root.locator('.brand-tagline')).toHaveCount(0)
  await expect(root.getByText('Powered by',{exact:true})).toBeVisible()
  await root.page().evaluate(()=>document.fonts.ready)
  const geometry=await root.locator('.dual-brand').evaluate(async el=>{
    async function ink(selector:string) {
      const image=el.querySelector(selector) as HTMLImageElement
      await image.decode()
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
      const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0)
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
      let left=canvas.width,top=canvas.height,right=0,bottom=0
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>8){
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1)
      }
      const r=image.getBoundingClientRect(),sx=r.width/canvas.width,sy=r.height/canvas.height
      return {left:r.left+left*sx,top:r.top+top*sy,right:r.left+right*sx,bottom:r.top+bottom*sy,distortion:Math.abs(sx-sy)}
    }
    const logo=await ink('.loading-logo img'),studio=await ink('.chavium-logo')
    // Measure actual glyph ink, not the SVG viewport, CSS line box or font leading.
    const text=el.querySelector('.yaydu-wordmark text') as SVGTextElement,s=getComputedStyle(text)
    const ctx=document.createElement('canvas').getContext('2d')!
    ctx.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;ctx.letterSpacing=s.letterSpacing
    const m=ctx.measureText('YAYDU'),matrix=text.getScreenCTM()!
    const top=new DOMPoint(-m.actualBoundingBoxLeft,-m.actualBoundingBoxAscent).matrixTransform(matrix)
    const bottom=new DOMPoint(m.actualBoundingBoxRight,m.actualBoundingBoxDescent).matrixTransform(matrix)
    const word={left:top.x,top:top.y,right:bottom.x,bottom:bottom.y}
    const left={top:Math.min(logo.top,word.top),bottom:Math.max(logo.bottom,word.bottom)}
    const separator=el.querySelector('.brand-separator')!.getBoundingClientRect(),powered=el.querySelector('.powered-by')!.getBoundingClientRect()
    return {heightDifference:Math.abs(left.bottom-left.top-(studio.bottom-studio.top)),centers:Math.abs((left.top+left.bottom-studio.top-studio.bottom)/2),gapDifference:Math.abs(separator.left-Math.max(logo.right,word.right)-(studio.left-separator.right)),labelAbove:powered.bottom<studio.top,distortion:Math.max(logo.distortion,studio.distortion,Math.abs(matrix.a-matrix.d)),wordRatio:(word.bottom-word.top)/(logo.bottom-logo.top),outside:[logo,word,studio,powered].some(r=>r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)}
  })
  expect(geometry.heightDifference).toBeLessThan(1)
  expect(geometry.centers).toBeLessThan(1)
  expect(geometry.gapDifference).toBeLessThan(1)
  expect(geometry.distortion).toBeLessThan(.001)
  expect(geometry.wordRatio).toBeCloseTo(12/84,2)
  expect(geometry.labelAbove).toBe(true)
  expect(geometry.outside).toBe(false)
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
