import {expect,test} from '@playwright/test'
for(const mobile of [false,true])test.describe(mobile?'mobile account access':'desktop account access',()=>{
 test.use({viewport:mobile?{width:844,height:390}:{width:1280,height:800},...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',hasTouch:true,isMobile:true}:{})})
 test('branding typography, placeholders, password toggle and generic credential failures',async({page})=>{
  await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:{url:'https://mock-project.supabase.co',publishableKey:'sb_publishable_test'}}}))
  await page.route('**/api/session',r=>r.fulfill({json:{user:null,room:null}}))
  let emailRequest:Record<string,unknown>|null=null,handleRequest:Record<string,unknown>|null=null
  await page.route('https://mock-project.supabase.co/auth/v1/token**',r=>{emailRequest=r.request().postDataJSON();return r.fulfill({status:400,json:{msg:'Invalid login credentials'}})})
  await page.route('**/api/auth/login',r=>{handleRequest=r.request().postDataJSON();return r.fulfill({status:401,json:{error:'Invalid email/username or password.'}})})
  await page.goto('/');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible()
  await expect(page.locator('.access-card > h2')).toHaveCount(0)
  await expect(page.getByPlaceholder('Email or username')).toHaveValue('')
  const typography=await page.locator('.access-story').evaluate(el=>{
   const tag=el.querySelector('.brand-tagline')!,copy=Array.from(el.querySelectorAll('p')).find(p=>p.textContent?.startsWith('Bring a name'))!,heading=el.querySelector('h1')!
   const style=(n:Element)=>{const s=getComputedStyle(n);return[s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle]}
   return {tag:style(tag),copy:style(copy),gap:tag.getBoundingClientRect().top-heading.getBoundingClientRect().bottom}
  })
  expect(typography.tag).toEqual(typography.copy);expect(typography.gap).toBeLessThanOrEqual(6)
  const password=page.getByLabel('Password',{exact:true});await password.fill('test-password');await page.getByRole('button',{name:'Show password',exact:true}).click();await expect(password).toHaveAttribute('type','text');await expect(password).toHaveValue('test-password');await page.getByRole('button',{name:'Hide password',exact:true}).click();await expect(password).toHaveAttribute('type','password')
  await page.getByLabel('Email or Username',{exact:true}).fill('PERSON@Example.test');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Invalid email/username or password.');expect(emailRequest).toMatchObject({email:'person@example.test',password:'test-password'})
  await page.getByLabel('Email or Username',{exact:true}).fill('CardMaster99');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect.poll(()=>handleRequest).toMatchObject({identifier:'CardMaster99',password:'test-password'});await expect(page.getByRole('alert')).toHaveText('Invalid email/username or password.')
  await page.getByRole('button',{name:'Continue as Guest',exact:true}).click();await expect(page.getByPlaceholder('Enter guest name')).toHaveValue('');await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('')
 })
 test('placeholder-only labels, paired signup fields and centered authentication controls',async({page})=>{
  await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:{url:'https://mock-project.supabase.co',publishableKey:'sb_publishable_test'}}}))
  await page.route('**/api/session',r=>r.fulfill({json:{user:null,room:null}}))
  await page.goto('/');await page.getByRole('button',{name:'Sign Up',exact:true}).click()
  async function checkPair(){
   const inputs=await page.locator('.signup-form input').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}))
   expect(inputs).toHaveLength(2);expect(inputs[0].y).toBe(inputs[1].y);expect(inputs[0].width).toBeCloseTo(inputs[1].width,0);expect(inputs[0].height).toBe(inputs[1].height);expect(inputs[1].x).toBeGreaterThan(inputs[0].x+inputs[0].width)
   const labels=await page.locator('.signup-form label > span.visually-hidden').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width))
   expect(labels).toEqual([1,1])
   const alignment=await page.locator('.access-page button').evaluateAll(nodes=>nodes.filter(n=>n.checkVisibility()).map(n=>{const s=getComputedStyle(n);return[s.justifyContent,s.textAlign]}))
   expect(alignment.every(([justify,text])=>justify==='center'&&text==='center')).toBe(true)
  }
  await checkPair();await page.getByLabel('First Name',{exact:true}).fill('John');await page.getByLabel('Last Name',{exact:true}).fill('Smith');await page.getByRole('button',{name:'Next',exact:true}).click();await checkPair()
 })
 for(const byUsername of [false,true])test(`successful ${byUsername?'username':'email'} sign-in restores the same verified account and SDK session`,async({page})=>{
  const id='11111111-1111-4111-8111-111111111111',now=Math.floor(Date.now()/1000)
  const token=[btoa(JSON.stringify({alg:'HS256',typ:'JWT'})),btoa(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})),btoa('test-signature')].map(part=>part.replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.')
  const providerUser={id,aud:'authenticated',role:'authenticated',email:'owner@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}}
  const session={access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:providerUser}
  const user={player:{id:`user:${id}`,displayName:'John Smith',username:'cardmaster99',firstName:'John',lastName:'Smith',accountType:'registered',avatarUrl:null},email:'owner@example.test',createdAt:'2026-01-01T00:00:00Z',lastActiveAt:'2026-11-11T00:00:00Z'}
  let signedIn=false,registrations=0
  await page.route('**/api/config',r=>r.fulfill({json:{service:'least-count',supabase:{url:'https://mock-project.supabase.co',publishableKey:'sb_publishable_test'}}}))
  await page.route('**/api/session',r=>r.fulfill({json:{user:signedIn?user:null,room:null}}))
  await page.route('https://mock-project.supabase.co/auth/v1/user',r=>r.fulfill({json:providerUser}))
  await page.route('**/api/career**',r=>r.fulfill({status:503,json:{error:'Career fixture unavailable'}}))
  await page.route('**/api/auth/register',r=>{registrations++;return r.fulfill({status:400,json:{error:'Unexpected registration'}})})
  await page.route('**/api/auth/login',r=>{signedIn=true;return r.fulfill({json:{session:{access_token:token,refresh_token:'test-refresh'}}})})
  await page.route('https://mock-project.supabase.co/auth/v1/token**',r=>{signedIn=true;expect(r.request().postDataJSON().email).toBe('owner@example.test');return r.fulfill({json:session})})
  await page.goto('/');await page.getByLabel('Email or Username',{exact:true}).fill(byUsername?'CardMaster99':'OWNER@EXAMPLE.TEST');await page.getByLabel('Password',{exact:true}).fill('verified-password');await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Welcome, John Smith (@cardmaster99).'})).toBeVisible();expect(registrations).toBe(0)
  await page.reload();await expect(page.getByRole('heading',{name:'Welcome, John Smith (@cardmaster99).'})).toBeVisible();expect(registrations).toBe(0)
 })

})
