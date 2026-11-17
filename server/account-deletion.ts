import { presenceDirectory } from './presence'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, directory, publicConfig } from './auth'
import { accessLimit } from './access'
import { ApiError, body, hash, json, randomToken, guestCookie } from './http'
import type { Env } from './types'

export type ErasureJob = {
  uid: string; namespace: string; phase: 'check'|'mark'|'rooms'|'avatars'|'history'|'auth';
  cursor?: string; nextCursor?: string; objects: string[]; index: number;
  nextAt: number; attempts: number; retrying?: boolean;
}
export type ErasureResult = { complete: true; expires: number } | { blocked: true; expires: number } | ErasureJob
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export function erasureAdmin(env: Env) {
  const key=env.SUPABASE_ACCOUNT_ADMIN_KEY || env.SUPABASE_CAREER_KEY
  if(!env.SUPABASE_URL || !key)throw new ApiError(503,'Account deletion is not configured yet. Please try later.')
  return createClient(env.SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)})}})
}
async function cloudflare(env:Env,path:string) {
  if(!/^[a-f0-9]{32}$/.test(env.ACCOUNT_DELETION_CF_ACCOUNT_ID??'') || !env.ACCOUNT_DELETION_CF_TOKEN)throw new ApiError(503,'Account deletion needs its room-cleanup configuration.')
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_DELETION_CF_ACCOUNT_ID}/workers/durable_objects/${path}`,{headers:{Authorization:`Bearer ${env.ACCOUNT_DELETION_CF_TOKEN}`},signal:AbortSignal.timeout(8000)})
  const result=await response.json() as {success?:boolean;result?:unknown[];result_info?:{cursor?:string}}
  if(!response.ok || result.success!==true || !Array.isArray(result.result))throw new ApiError(503,'Room cleanup is unavailable. Please try later.')
  return result
}
async function objects(env:Env,namespace:string,cursor?:string) {
  const query=new URLSearchParams({limit:'10'});if(cursor)query.set('cursor',cursor)
  const result=await cloudflare(env,`namespaces/${namespace}/objects?${query}`)
  const ids=(result.result as {id?:string;hasStoredData?:boolean}[]).filter(item=>item.hasStoredData!==false).map(item=>{
    if(!/^[a-f0-9]{64}$/.test(item.id??''))throw new ApiError(503,'Room cleanup returned invalid metadata.')
    return item.id!
  })
  const next=result.result_info?.cursor
  return {ids,next:next && next!==cursor?next:undefined}
}
export async function deletionNamespace(env:Env) {
  const result=await cloudflare(env,'namespaces?per_page=100')
  const matches=(result.result as {id?:string;class?:string;script?:string}[]).filter(n=>n.class==='GameRoom'&&n.script===(env.ACCOUNT_DELETION_WORKER_NAME||'least-count'))
  if(matches.length!==1 || !/^[a-f0-9]{32}$/.test(matches[0].id??''))throw new ApiError(503,'The production game-room namespace could not be verified.')
  await objects(env,matches[0].id!) // Check object-list permission before accepting deletion.
  return matches[0].id!
}
const deletionCookieName=(request:Request)=>new URL(request.url).protocol==='https:'?'__Host-yaydu-delete':'yaydu-delete'
const deletionCookie=(request:Request,token:string,age=86400)=>`${deletionCookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`
export async function startDeletion(request:Request,env:Env) {
  if(!env.CAREER_ORIGIN || new URL(request.url).origin!==env.CAREER_ORIGIN)throw new ApiError(403,'Account deletion is available only on the production game website.')
  await accessLimit(request,env,'account-delete')
  const input=await body(request),auth=await requireAuth(request,env)
  if(!auth.uid || !auth.client || !auth.user.email)throw new ApiError(403,'Only a registered account can be deleted.')
  if(input.confirmation!=='DELETE' || typeof input.password!=='string' || !input.password || input.password.length>128 || input.userId!==undefined)throw new ApiError(400,'Type DELETE and enter your current password to confirm permanent deletion.')
  const config=publicConfig(env).supabase!
  const verifier=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)})}})
  const verified=await verifier.auth.signInWithPassword({email:auth.user.email,password:input.password})
  if(verified.error || verified.data.user?.id!==auth.uid || !verified.data.user.email_confirmed_at)throw new ApiError(401,'The current password could not be verified.')
  const admin=erasureAdmin(env),ready=await admin.rpc('account_erasure_ready')
  if(ready.error || ready.data!==true)throw new ApiError(503,'Account deletion needs the account-erasure database migration.')
  const namespace=await deletionNamespace(env)
  const response=await directory(env,'/erasure/start',{uid:auth.uid,namespace})
  if(!response.ok)throw new ApiError(503,'Deletion could not be scheduled. Please retry.')
  const job=await response.json() as {token:string}
  return new Response(JSON.stringify({pending:true}),{status:202,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':deletionCookie(request,job.token)}})
}
export async function deletionStatus(request:Request,env:Env) {
  const token=(request.headers.get('Cookie')??'').split(';').map(part=>part.trim()).find(part=>part.startsWith(`${deletionCookieName(request)}=`))?.split('=')[1]??''
  if(!/^[a-f0-9]{64}$/.test(token))throw new ApiError(404,'No account deletion is pending in this browser.')
  const response=await directory(env,'/erasure/status',{token})
  const result=await response.json() as {complete?:boolean;blocked?:boolean;retrying?:boolean}
  if(!response.ok)throw new ApiError(404,'The deletion status has expired.')
  const output=json(result)
  if(result.complete || result.blocked)output.headers.append('Set-Cookie',deletionCookie(request,'',0))
  if(result.complete)output.headers.append('Set-Cookie',guestCookie(request,'',0))
  return output
}
async function eraseAvatars(env:Env,uid:string,path=uid,budget={calls:20}):Promise<boolean> {
  const bucket=erasureAdmin(env).storage.from('avatars')
  while(budget.calls>1) {
    budget.calls--
    const listing=await bucket.list(path,{limit:100})
    if(listing.error)throw new Error('Avatar listing unavailable')
    if(!listing.data?.length)return true
    const files:string[]=[]
    for(const item of listing.data) {
      if(!item.name || item.name==='.' || item.name==='..' || item.name.includes('/'))throw new Error('Invalid avatar path')
      const name=`${path}/${item.name}`
      if(item.id==null){if(!await eraseAvatars(env,uid,name,budget))return false}
      else files.push(name)
    }
    if(files.length){budget.calls--;const removed=await bucket.remove(files);if(removed.error)throw new Error('Avatar removal unavailable')}
  }
  return false
}
/** One bounded durable step; retries never rely on a now-deleted browser session. */
export async function stepErasure(job:ErasureJob,env:Env):Promise<'continue'|'complete'|'blocked'> {
  if(!uuid.test(job.uid))throw new Error('Invalid account identity')
  const admin=erasureAdmin(env)
  if(job.phase==='check'||job.phase==='rooms') {
    if(job.index>=job.objects.length) {
      if(job.objects.length && !job.nextCursor) {
        job.objects=[];job.index=0;job.cursor=undefined
        job.phase=job.phase==='check'?'mark':'avatars';return 'continue'
      }
      const page=await objects(env,job.namespace,job.cursor)
      job.objects=page.ids;job.index=0;job.nextCursor=page.next
      if(!page.ids.length) {
        if(page.next){job.cursor=page.next;return 'continue'}
        job.cursor=undefined;job.phase=job.phase==='check'?'mark':'avatars';return 'continue'
      }
    }
    for(let count=0;count<5 && job.index<job.objects.length;count++,job.index++) {
      const stub=env.ROOMS.get(env.ROOMS.idFromString(job.objects[job.index]))
      const response=await stub.fetch(`https://room/account-erasure/${job.phase==='check'?'check':'erase'}`,{method:'POST',body:JSON.stringify({uid:job.uid})})
      if(!response.ok)throw new Error('Room cleanup unavailable')
      const result=await response.json() as {blocked?:boolean}
      if(result.blocked){if(job.phase==='check')return 'blocked';throw new Error('An active game still needs cleanup')}
    }
    if(job.index===job.objects.length && job.nextCursor){job.cursor=job.nextCursor;job.objects=[];job.index=0}
    return 'continue'
  }
  if(job.phase==='mark') {
    const user=await admin.auth.admin.getUserById(job.uid)
    if(user.error && user.error.status!==404)throw user.error
    if(user.data.user) {
      const marked=await admin.auth.admin.updateUserById(job.uid,{app_metadata:{...user.data.user.app_metadata,account_deletion_pending:true}})
      if(marked.error)throw marked.error
    }
    const prepared=await admin.rpc('prepare_account_erasure',{account_id:job.uid})
    if(prepared.error)throw prepared.error
    job.phase='rooms';job.objects=[];job.index=0;job.cursor=undefined;job.nextCursor=undefined;return 'continue'
  }
  if(job.phase==='avatars'){if(await eraseAvatars(env,job.uid))job.phase='history';return 'continue'}
  if(job.phase==='history') {
    const result=await admin.rpc('anonymize_account_history',{account_id:job.uid});if(result.error)throw result.error
    job.phase='auth';return 'continue'
  }
  const presence=await presenceDirectory(env,'erase',{uid:job.uid})
  if(!presence.ok)throw new Error('Presence cleanup unavailable')
  const removed=await admin.auth.admin.deleteUser(job.uid)
  if(removed.error && removed.error.status!==404)throw removed.error
  return 'complete'
}
export { hash, randomToken }
