import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {availability,login,register,accessLimit} from './access'
import type {Env} from './types'
const env={SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_CAREER_KEY:'sb_secret_server_only'} as Env
const input={email:' New@Example.test ',password:'private-password',data:{username:'CardMaster99',first_name:' John ',last_name:' Smith '},code_challenge:'x'.repeat(43),code_challenge_method:'s256'}
const request=new Request('https://game.test/api/auth/register',{headers:{Origin:'https://game.test'}})
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
beforeEach(()=>vi.spyOn(console,'warn').mockImplementation(()=>{}))
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
describe('private access endpoints',()=>{
 it('normalizes availability, returns only booleans and fails closed without migration/service key',async()=>{
  const fetch=vi.fn(async(_url:RequestInfo|URL,_options?:RequestInit)=>json({usernameAvailable:true,emailAvailable:false,privateEmail:'never-return@example.test'}));vi.stubGlobal('fetch',fetch)
  expect(await availability(env,{username:'CardMaster99',email:' NEW@Example.test '})).toEqual({usernameAvailable:true,emailAvailable:false})
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({candidate:'cardmaster99',address:'new@example.test'})
  await expect(availability({...env,SUPABASE_CAREER_KEY:undefined},{username:'CardMaster99',email:'new@example.test'})).rejects.toMatchObject({status:503})
  vi.stubGlobal('fetch',vi.fn(async()=>json({code:'PGRST202'},404)))
  await expect(availability(env,{username:'CardMaster99',email:'new@example.test'})).rejects.toMatchObject({code:'ACCESS_UNAVAILABLE'})
 })
 it('resolves usernames privately and lets Supabase verify the unchanged password',async()=>{
  const calls:{url:string;body:unknown}[]=[]
  vi.stubGlobal('fetch',vi.fn(async(url,options)=>{calls.push({url:String(url),body:options?.body});return String(url).includes('/rpc/')?json('private@example.test'):json({access_token:'own-access',refresh_token:'own-refresh',expires_in:3600,token_type:'bearer',user:{id:'user-id',email:'private@example.test',email_confirmed_at:'2026-01-01'}})}))
  expect(await login(env,{identifier:'CardMaster99',password:'unchanged-password'})).toEqual({session:{access_token:'own-access',refresh_token:'own-refresh'}})
  expect(JSON.parse(String(calls[0].body))).toEqual({candidate:'cardmaster99'})
  expect(JSON.parse(String(calls[1].body))).toMatchObject({email:'private@example.test',password:'unchanged-password'})
 })
 it.each([true,false])('unknown username and wrong password have identical errors (known=%s)',async(known)=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/rpc/')?json(known?'private@example.test':null):json({msg:'Invalid login credentials'},400)))
  await expect(login(env,{identifier:'CardMaster99',password:'wrong-password'})).rejects.toMatchObject({status:401,message:'Invalid email/username or password.'})
 })
 it('forwards the browser PKCE challenge and only validated identity metadata at final signup',async()=>{
  const calls:{url:string;body:Record<string,unknown>;headers:HeadersInit|undefined}[]=[]
  vi.stubGlobal('fetch',vi.fn(async(url,options)=>{calls.push({url:String(url),body:JSON.parse(String(options?.body)),headers:options?.headers});return String(url).includes('/rpc/')?json({usernameAvailable:true,emailAvailable:true}):json({id:'new-id',identities:[{}],email:'new@example.test'})}))
  const result=await register(request,env,input);expect(result).toMatchObject({id:'new-id'})
  expect(calls[1].url).toContain('redirect_to=https%3A%2F%2Fgame.test%2Fauth%2Fcallback')
  expect(calls[1].body).toMatchObject({email:'new@example.test',password:'private-password',code_challenge:'x'.repeat(43),code_challenge_method:'s256',data:{username:'cardmaster99',first_name:'John',last_name:'Smith'}})
  expect(JSON.stringify(result)).not.toContain('sb_secret')
 })
 it.each([{...input,data:{...input.data,first_name:'John1'}},{...input,data:{...input.data,last_name:'Mary Jane'}},{...input,data:{...input.data,username:'X'.repeat(21)}},{...input,email:'not-an-email'},{...input,password:'        '}])('rejects malformed final signup before provider creation',async(payload)=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
  await expect(register(request,env,payload)).rejects.toMatchObject({status:400});expect(fetch).not.toHaveBeenCalled()
 })
 it('rechecks after a concurrent provider failure and reports the contested identity',async()=>{
  let checks=0;vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/rpc/')?json({usernameAvailable:++checks===1,emailAvailable:true}):json({msg:'Database error saving new user'},500)))
  await expect(register(request,env,input)).rejects.toMatchObject({status:409,message:expect.stringContaining('username is already taken')});expect(checks).toBe(2)
 })
 it('prevents duplicate emails before provider creation and detects provider duplicate obfuscation',async()=>{
  const fetch=vi.fn(async()=>json({usernameAvailable:true,emailAvailable:false}));vi.stubGlobal('fetch',fetch)
  await expect(register(request,env,input)).rejects.toMatchObject({status:409,message:'This email address is already registered.'});expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('rate limits with a hashed client address in the existing Durable Object namespace',async()=>{
  const fetch=vi.fn(async()=>json({},429)),idFromName=vi.fn((id)=>id)
  const limited={DIRECTORY:{idFromName,get:()=>({fetch})}} as unknown as Env
  await expect(accessLimit(new Request('https://game.test/api/auth/login',{headers:{'CF-Connecting-IP':'203.0.113.4'}}),limited,'login')).rejects.toMatchObject({status:429})
  expect(idFromName.mock.calls[0][0]).toMatch(/^access:[a-f0-9]{64}$/)
 })
})

it('retains provider password policy feedback without exposing provider internals',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/rpc/')?json({usernameAvailable:true,emailAvailable:true}):json({code:'weak_password',msg:'internal provider detail'},422)))
 await expect(register(request,env,input)).rejects.toMatchObject({status:400,message:'Password does not meet the account security requirements. Choose a stronger password.'})
})


describe('provider signup failure reporting',()=>{
 it.each([
  ['over_email_send_rate_limit',429,429,'SIGNUP_EMAIL_RATE_LIMIT','Verification emails are temporarily rate-limited'],
  ['over_request_rate_limit',429,429,'SIGNUP_RATE_LIMIT','Registration is temporarily rate-limited'],
  ['email_address_not_authorized',403,503,'SIGNUP_EMAIL_DELIVERY_UNAVAILABLE','Verification emails cannot currently be sent'],
  ['signup_disabled',422,503,'SIGNUP_DISABLED','registration is currently disabled'],
  ['email_provider_disabled',422,503,'SIGNUP_DISABLED','Email registration is currently unavailable'],
  ['captcha_failed',422,400,'SIGNUP_CAPTCHA_FAILED','verification check failed'],
  ['unknown_provider_error',429,429,'SIGNUP_RATE_LIMIT','Registration is temporarily rate-limited'],
 ])('reports %s safely without another availability query',async(providerCode,providerStatus,status,code,message)=>{
  const fetch=vi.fn(async(url)=>String(url).includes('/rpc/')?json({usernameAvailable:true,emailAvailable:true}):json({error_code:providerCode,msg:'private@example.test internal-secret'},providerStatus as number));vi.stubGlobal('fetch',fetch)
  await expect(register(request,env,input)).rejects.toMatchObject({status,code,message:expect.stringContaining(message as string)})
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/private@example|internal-secret|private-password|CardMaster99|sb_secret/)
 })
 it('records a database/provider failure with a safe reference rather than blaming entered details',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/rpc/')?json({usernameAvailable:true,emailAvailable:true}):json({code:'unexpected_failure',msg:'Database error saving private@example.test, SQL secret'},500)))
  let failure:unknown;try{await register(request,env,input)}catch(error){failure=error}
  expect(failure).toMatchObject({status:503,code:'SIGNUP_PROVIDER_ERROR',message:expect.stringContaining('temporarily unavailable')})
  const record=JSON.parse(vi.mocked(console.warn).mock.calls[0][0])
  expect(record).toMatchObject({event:'signup_provider_failure',status:500,providerCode:'unexpected_failure'})
  expect((failure as Error).message).toContain(record.reference)
  expect(JSON.stringify(record)).not.toMatch(/private@example|SQL secret|private-password|sb_secret/)
 })
 it('preserves the original provider failure when its secondary availability recheck fails',async()=>{
  let checks=0;vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/rpc/')?++checks===1?json({usernameAvailable:true,emailAvailable:true}):json({code:'PGRST202'},404):json({code:'unexpected_failure'},500)))
  await expect(register(request,env,input)).rejects.toMatchObject({status:503,code:'SIGNUP_PROVIDER_ERROR'})
 })
 it.each([new DOMException('private provider URL','TimeoutError'),new Error('sensitive network details')])('handles transport failures without retrying signup',async(reason)=>{
  const fetch=vi.fn(async(url)=>{if(String(url).includes('/rpc/'))return json({usernameAvailable:true,emailAvailable:true});throw reason});vi.stubGlobal('fetch',fetch)
  await expect(register(request,env,input)).rejects.toMatchObject({status:reason.name==='TimeoutError'?504:503,message:expect.not.stringMatching(/sensitive|private provider/)})
  expect(fetch).toHaveBeenCalledTimes(2)
 })
 it.each([new Response('<html>private upstream failure</html>',{status:502}),json(null),json({})])('rejects malformed provider responses rather than claiming successful account creation',async(response)=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/rpc/')?json({usernameAvailable:true,emailAvailable:true}):response.clone()))
  await expect(register(request,env,input)).rejects.toMatchObject({status:503,code:'SIGNUP_PROVIDER_ERROR'})
 })
})
