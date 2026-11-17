import { afterEach, expect, it, vi } from 'vitest'
import worker from './index'
import { stepErasure } from './account-deletion'
import type { ErasureJob } from './account-deletion'
import type { Env } from './types'
const uid='11111111-1111-4111-8111-111111111111', ns='a'.repeat(32), oid='b'.repeat(64), token='c'.repeat(64)
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
const authUser={id:uid,email:'private@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{},app_metadata:{},created_at:new Date().toISOString()}
const jwt=`a.${btoa(JSON.stringify({exp:Date.now()/1000+3600}))}.c`
function harness(){
  const calls:{url:string;body:unknown}[]=[],queued:unknown[]=[]
  let wrongPassword=false,wrongUser=false,blocked=false,ready=true,storageError=false,authError=false,files=['old.png','orphan.webp']
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_CAREER_KEY:'server-only',CAREER_ORIGIN:'https://game.test',ACCOUNT_DELETION_CF_ACCOUNT_ID:'d'.repeat(32),ACCOUNT_DELETION_CF_TOKEN:'cf-server-only',
    DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async(url:string,init:RequestInit)=>{
      const data=JSON.parse(String(init.body));if(url.endsWith('/session'))return json(null);if(url.endsWith('/erasure/start')){queued.push(data);return json({token})}
      if(url.endsWith('/erasure/status'))return json({complete:true})
      return json({ok:true})
    }})},ROOMS:{idFromString:(id:string)=>id,get:()=>({fetch:async(url:string)=>{calls.push({url,body:null});return json({blocked})}})}} as unknown as Env
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input),body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,body})
    if(url.includes('api.cloudflare.com'))return url.includes('/objects?')?json({success:true,result:[{id:oid,hasStoredData:true}]}):json({success:true,result:[{id:ns,class:'GameRoom',script:'least-count'}]})
    if(url.endsWith('/auth/v1/user'))return json(authUser)
    if(url.includes('/token?'))return wrongPassword?json({msg:'Invalid credentials'},400):json({access_token:jwt,refresh_token:'private-refresh',expires_in:3600,token_type:'bearer',user:{...authUser,id:wrongUser?'other':uid}})
    if(url.endsWith('/rpc/ensure_player_profile'))return json({id:uid,display_name:'Owner',created_at:authUser.created_at,last_active_at:authUser.created_at})
    if(url.endsWith('/rpc/account_erasure_ready'))return json(ready)
    if(url.endsWith('/rpc/prepare_account_erasure')||url.endsWith('/rpc/anonymize_account_history'))return json(null)
    if(url.includes('/admin/users/')){
      if(init?.method==='DELETE')return authError?json({message:'Unavailable'},503):json({user:authUser})
      return json({user:authUser})
    }
    if(url.includes('/storage/v1/object/list/avatars'))return storageError?json({message:'Storage offline'},503):json(files.map(name=>({id:name,name})))
    if(url.endsWith('/storage/v1/object/avatars')&&init?.method==='DELETE'){files=[];return json([])}
    throw new Error(`Unexpected URL ${url}`)
  }))
  const request=(input:unknown={confirmation:'DELETE',password:'current-password'},origin='https://game.test')=>new Request('https://game.test/api/account',{method:'DELETE',headers:{Origin:origin,Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify(input)})
  const job=(phase:ErasureJob['phase']='check'):ErasureJob=>({uid,namespace:ns,phase,objects:[],index:0,nextAt:0,attempts:0})
  return {env,calls,queued,request,job,set:(flags:{wrongPassword?:boolean;wrongUser?:boolean;blocked?:boolean;ready?:boolean;storageError?:boolean;authError?:boolean})=>{wrongPassword=flags.wrongPassword??false;wrongUser=flags.wrongUser??false;blocked=flags.blocked??false;ready=flags.ready??true;storageError=flags.storageError??false;authError=flags.authError??false}}
}
afterEach(()=>vi.unstubAllGlobals())
it('requires matching origin, current password, exact confirmation and authenticated ownership',async()=>{
  const h=harness()
  for(const [input,origin,status] of [[{confirmation:'DELETE',password:'secret'},'https://evil.test',403],[{confirmation:'delete',password:'secret'},'https://game.test',400],[{confirmation:'DELETE',password:'secret',userId:'other'},'https://game.test',400]] as const){expect((await worker.fetch(h.request(input,origin),h.env)).status).toBe(status)}
  h.set({wrongPassword:true});expect((await worker.fetch(h.request(),h.env)).status).toBe(401)
  h.set({wrongUser:true});expect((await worker.fetch(h.request(),h.env)).status).toBe(401)
  expect(h.queued).toHaveLength(0)
  const noAuth=h.request();noAuth.headers.delete('Authorization');expect((await worker.fetch(noAuth,h.env)).status).toBe(401)
})
it('fails closed before any deletion when migration or room enumeration is unavailable',async()=>{
  const h=harness();h.set({ready:false});expect((await worker.fetch(h.request(),h.env)).status).toBe(503)
  h.set({});delete h.env.ACCOUNT_DELETION_CF_TOKEN;expect((await worker.fetch(h.request(),h.env)).status).toBe(503)
  expect(h.queued).toHaveLength(0);expect(h.calls.some(c=>c.url.includes('/admin/users/'))).toBe(false)
})
it('queues only the verified owner and returns a secure, opaque status cookie',async()=>{
  const h=harness(),response=await worker.fetch(h.request(),h.env)
  expect(response.status).toBe(202);expect(h.queued).toEqual([{uid,namespace:ns}]);expect(JSON.stringify(h.queued)).not.toContain('password')
  expect(response.headers.get('Set-Cookie')).toContain(`__Host-yaydu-delete=${token}`);expect(response.headers.get('Set-Cookie')).toContain('HttpOnly; SameSite=Strict');expect(response.headers.get('Set-Cookie')).toContain('Secure')
  expect(await response.json()).toEqual({pending:true})
  const result=await worker.fetch(new Request('https://game.test/api/account/deletion-status',{method:'POST',headers:{Origin:'https://game.test',Cookie:`__Host-yaydu-delete=${token}`,Authorization:'Bearer revoked-token'}}),h.env)
  expect(await result.json()).toEqual({complete:true});expect(result.headers.get('Set-Cookie')).toContain('Max-Age=0')
})
it('preflights every room without modifying an account when an active game blocks deletion',async()=>{
  const h=harness();h.set({blocked:true});const job=h.job()
  expect(await stepErasure(job,h.env)).toBe('blocked');expect(h.calls.some(c=>c.url.includes('/admin/users/'))).toBe(false)
})
it('durably advances through room, photo, history and Auth Admin cleanup in that order',async()=>{
  const h=harness(),job=h.job()
  for(let n=0;n<12;n++){if(await stepErasure(job,h.env)==='complete')break}
  const urls=h.calls.map(c=>c.url),erase=urls.findIndex(u=>u.endsWith('/account-erasure/erase')),photos=urls.findIndex(u=>u.includes('/object/list/')),history=urls.findIndex(u=>u.endsWith('/anonymize_account_history')),deletion=h.calls.findLastIndex(c=>c.url.includes('/admin/users/')&&c.body===null)
  expect(erase).toBeGreaterThan(-1);expect(photos).toBeGreaterThan(erase);expect(history).toBeGreaterThan(photos);expect(deletion).toBeGreaterThan(history)
  expect(h.calls.find(c=>c.url.endsWith('/prepare_account_erasure'))?.body).toEqual({account_id:uid})
})
it('does not delete authentication before avatar cleanup succeeds and retries idempotently',async()=>{
  const h=harness(),job=h.job('avatars');h.set({storageError:true})
  await expect(stepErasure(job,h.env)).rejects.toBeDefined();expect(job.phase).toBe('avatars');expect(h.calls.some(c=>c.url.includes('/admin/users/'))).toBe(false)
  h.set({});expect(await stepErasure(job,h.env)).toBe('continue');expect(job.phase).toBe('history')
  await stepErasure(job,h.env);h.set({authError:true});await expect(stepErasure(job,h.env)).rejects.toBeDefined();expect(job.phase).toBe('auth')
  h.set({});expect(await stepErasure(job,h.env)).toBe('complete')
})
it('checks every page of retained objects, including pages without stored data',async()=>{
  const h=harness(),job=h.job();let pages=0
  const original=globalThis.fetch
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input).includes('/objects?')){pages++;return json({success:true,result:pages===1?[{id:oid,hasStoredData:false}]:[{id:oid,hasStoredData:true}],result_info:pages===1?{cursor:'next-page'}:{}})}
    return original(input,init)
  }))
  for(let n=0;n<5&&job.phase==='check';n++)await stepErasure(job,h.env)
  expect(pages).toBe(2);expect(job.phase).toBe('mark');expect(h.calls.filter(c=>c.url.endsWith('/account-erasure/check'))).toHaveLength(1)
})
