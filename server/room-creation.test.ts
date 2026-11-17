import {afterEach,expect,it,vi} from 'vitest'
import worker from './index'
import {Directory,GameRoom} from './objects'
import {hash} from './http'
import type {Env} from './types'
import type {RoomRecord} from './room'
const uid='11111111-1111-4111-8111-111111111111'
/** Match Durable Object input gates: requests queue until blockConcurrencyWhile resolves. */
function memory(){
 const values=new Map<string,unknown>();let queue=Promise.resolve<unknown>(undefined)
 const ctx={blockConcurrencyWhile:(fn:()=>Promise<unknown>)=>{const next=queue.then(fn);queue=next.catch(()=>{});return next},getWebSockets:()=>[],waitUntil:()=>{},storage:{get:async(k:string)=>structuredClone(values.get(k)),put:async(k:string|Record<string,unknown>,v:unknown)=>{if(typeof k==='string')values.set(k,structuredClone(v));else Object.entries(k).forEach(([key,value])=>values.set(key,structuredClone(value)))},delete:async(k:string)=>values.delete(k),setAlarm:async()=>{},deleteAlarm:async()=>{}}} as unknown as DurableObjectState
 return{ctx,values}
}
function harness(){
 const directoryState=memory(),rooms=new Map<string,{object:GameRoom;state:ReturnType<typeof memory>}>(),calls:string[]=[]
 let directory:Directory
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',DIRECTORY:{idFromName:(name:string)=>name,get:()=>({fetch:(url:string,init:RequestInit)=>{calls.push(new URL(url).pathname);return directory.fetch(new Request(url,init))}})},ROOMS:{idFromName:(id:string)=>id,get:(id:string)=>{if(!rooms.has(id)){const state=memory();rooms.set(id,{state,object:new GameRoom(state.ctx,env)})}return{fetch:(url:string,init:RequestInit)=>rooms.get(id)!.object.fetch(new Request(url,init))}}}} as unknown as Env
 directory=new Directory(directoryState.ctx,env)
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  const url=String(input),data=url.endsWith('/auth/v1/user')?{id:uid,email:'test@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{},app_metadata:{},created_at:'2026-01-01T00:00:00Z'}:{id:uid,display_name:'Tester',created_at:'2026-01-01T00:00:00Z',last_active_at:'2026-01-01T00:00:00Z'}
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})
 }))
 const token=`a.${btoa(JSON.stringify({exp:Date.now()/1000+3600}))}.c`
 const request=(settings:unknown)=>new Request('https://game.test/api/rooms',{method:'POST',headers:{Origin:'https://game.test',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(settings)})
 return{env,directory,directoryState,rooms,calls,request}
}
async function completes<T>(promise:Promise<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined
 try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Room creation stalled: Directory → GameRoom → locked Directory callback')),300)})])}finally{clearTimeout(timer)}
}
afterEach(()=>vi.unstubAllGlobals())
it.each([{maxPlayers:2,eliminationThreshold:100,timedGame:true},{maxPlayers:8,eliminationThreshold:200,timedGame:false}])('registered creation completes through real serialized directory/room gates: %j',async(settings)=>{
 const h=harness(),response=await completes(worker.fetch(h.request(settings),h.env))
 expect(response.status).toBe(201)
 const reservation=await response.json() as {id:string;code:string}
 expect(reservation.code).toMatch(/^[A-Z2-9]{6}$/)
 const room=h.rooms.get(reservation.id)!.state.values.get('room') as RoomRecord
 expect(room).toMatchObject({status:'waiting',hostId:`user:${uid}`,settings,members:[{id:`user:${uid}`,accountType:'registered'}]})
 expect(h.directoryState.values.get(`member:user:${uid}`)).toEqual(reservation)
 expect(h.calls).not.toContain('/erasure/locked')
 // Subsequent room requests still check deletion eligibility, outside the create gate.
 const view=await completes(h.rooms.get(reservation.id)!.object.fetch(new Request('https://room/view',{method:'POST',body:JSON.stringify({identity:{id:`user:${uid}`,accountType:'registered',displayName:'Tester',avatarUrl:null,expiresAt:Date.now()+3600000}})})))
 expect(view.ok).toBe(true);expect(h.calls).toContain('/erasure/locked')
 h.directoryState.values.set(`erasure-owner:${await hash(uid)}`,'pending-job')
 for(const operation of ['view','join']){
  const blocked=await completes(h.rooms.get(reservation.id)!.object.fetch(new Request(`https://room/${operation}`,{method:'POST',body:JSON.stringify({identity:{id:`user:${uid}`,accountType:'registered'}})})))
  expect(blocked.status).toBe(403);expect(await blocked.json()).toMatchObject({error:'Account deletion is in progress.'})
 }
})
it('blocks creation during deletion without reserving a code or initializing a room',async()=>{
 const h=harness();h.directoryState.values.set(`erasure-owner:${await hash(uid)}`,'pending-job')
 const response=await completes(worker.fetch(h.request({maxPlayers:2,eliminationThreshold:100,timedGame:true}),h.env))
 expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:'Account deletion is in progress.'});expect(h.rooms.size).toBe(0)
 expect([...h.directoryState.values.keys()].some(key=>key.startsWith('room:')||key.startsWith('member:'))).toBe(false)
})
it('returns JSON if the directory transport fails, rather than rejecting the Worker handler',async()=>{
 const h=harness();h.env.DIRECTORY.get=(()=>({fetch:async()=>{throw new Error('Directory unavailable')}})) as unknown as typeof h.env.DIRECTORY.get
 const response=await worker.fetch(h.request({maxPlayers:2,eliminationThreshold:100,timedGame:true}),h.env)
 expect(response.status).toBe(503);expect(response.headers.get('Content-Type')).toContain('application/json');expect(await response.json()).toMatchObject({error:'Room creation is temporarily unavailable. Please retry.'})
})
