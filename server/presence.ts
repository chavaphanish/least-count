import { createClient } from '@supabase/supabase-js'
import { publicConfig } from './auth'
import { ApiError, body, hash, json } from './http'
import type { Env } from './types'
export const PRESENCE_TTL = 60_000
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
type Session = { until:number; revoked?:boolean }
type Presence = { sessions:Record<string,Session>; deletedUntil?:number }
export function presenceDirectory(env:Env,path:string,data:unknown) {
  return env.DIRECTORY.get(env.DIRECTORY.idFromName('presence')).fetch(`https://directory/presence/${path}`,{method:'POST',body:JSON.stringify(data)})
}
function claims(request:Request) {
  const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if(!token || token.length>10000)throw new ApiError(401,'Sign in to update presence.')
  try {return {token,payload:JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}}catch{throw new ApiError(401,'Sign in again.')}
}
/** Only use after getUser has verified this token, or existing authenticate has verified the owner. */
async function sessionIdentity(request:Request,uid:string) {
  const {payload}=claims(request),expiresAt=Number(payload.exp)*1000
  if(!uuid.test(payload.session_id??'') || !Number.isFinite(expiresAt) || expiresAt<=Date.now())throw new ApiError(401,'Sign in again.')
  return {uid,session:await hash(`${uid}:${payload.session_id}`),expiresAt}
}
export async function clearPresence(request:Request,env:Env,uid:string) {
  // Legacy/test credentials without a session claim never started presence.
  if(!claims(request).payload.session_id)return
  const response=await presenceDirectory(env,'leave',await sessionIdentity(request,uid))
  if(!response.ok)throw new ApiError(503,'Could not clear presence. Please retry sign out.')
}
export async function presenceApi(request:Request,env:Env) {
  const input=await body(request)
  if(!Array.isArray(input.ids)||input.ids.length>100||input.ids.some(id=>typeof id!=='string'||!uuid.test(id)))throw new ApiError(400,'Request up to 100 player IDs.')
  let identity={}
  if(input.heartbeat===true) {
    const config=publicConfig(env).supabase
    if(!config)throw new ApiError(503,'Registered accounts are not configured.')
    const {token}=claims(request)
    const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(8000)})}})
    const {data,error}=await client.auth.getUser(token)
    if(error||!data.user)throw new ApiError(401,'Sign in again.')
    if(data.user.is_anonymous||!data.user.email_confirmed_at||data.user.app_metadata?.account_deletion_pending===true)throw new ApiError(403,'A verified active account is required.')
    identity=await sessionIdentity(request,data.user.id)
  } else if(input.heartbeat!==false)throw new ApiError(400,'Specify heartbeat or query.')
  const result=await presenceDirectory(env,input.heartbeat?'heartbeat':'query',{...identity,ids:[...new Set(input.ids)]})
  return result
}
function prune(value:Presence,now:number) {
  for(const [id,session]of Object.entries(value.sessions))if(session.until<=now)delete value.sessions[id]
  if(value.deletedUntil && value.deletedUntil<=now)delete value.deletedUntil
  return value
}
export async function presenceOperation(storage:DurableObjectStorage,path:string,input:Record<string,unknown>,now=Date.now()) {
  if(path!=='query') {
    const uid=String(input.uid)
    if(!uuid.test(uid))throw new ApiError(400,'Invalid presence identity.')
    const key=`presence:${await hash(uid)}`,state=prune((await storage.get<Presence>(key))??{sessions:{}},now)
    if(path==='erase') {state.sessions={};state.deletedUntil=now+86400000}
    else {
      const session=String(input.session),expiresAt=Number(input.expiresAt)
      if(!/^[a-f0-9]{64}$/.test(session)||!Number.isFinite(expiresAt)||expiresAt<=now)throw new ApiError(401,'Presence session expired.')
      if(path==='leave')state.sessions[session]={revoked:true,until:expiresAt+PRESENCE_TTL}
      else if(path==='heartbeat') {
        if(state.deletedUntil||state.sessions[session]?.revoked)throw new ApiError(403,'This presence session has ended.')
        state.sessions[session]={until:Math.min(now+PRESENCE_TTL,expiresAt)}
      } else throw new ApiError(404,'Unknown presence operation.')
    }
    await storage.put(key,state)
    const deadline=Math.min(state.deletedUntil??Infinity,...Object.values(state.sessions).map(s=>s.until))
    await storage.setAlarm(Math.min((await storage.getAlarm())??Infinity,deadline))
  }
  const ids=input.ids??[]
  if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!uuid.test(id)))throw new ApiError(400,'Invalid presence query.')
  const online:Record<string,number>={}
  await Promise.all(ids.map(async(uid:string)=>{
    const value=await storage.get<Presence>(`presence:${await hash(uid)}`)
    if(!value||value.deletedUntil)return
    const until=Math.max(0,...Object.values(value.sessions).filter(s=>!s.revoked).map(s=>s.until))
    if(until>now)online[uid]=Math.min(PRESENCE_TTL,until-now)
  }))
  return json({online})
}
export async function sweepPresence(storage:DurableObjectStorage,now:number) {
  let next=Infinity
  for(const [key,value]of await storage.list<Presence>({prefix:'presence:'})) {
    const before=JSON.stringify(value);prune(value,now)
    if(!value.deletedUntil&&!Object.keys(value.sessions).length)await storage.delete(key)
    else {
      if(before!==JSON.stringify(value))await storage.put(key,value)
      next=Math.min(next,value.deletedUntil??Infinity,...Object.values(value.sessions).map(s=>s.until))
    }
  }
  return next
}
