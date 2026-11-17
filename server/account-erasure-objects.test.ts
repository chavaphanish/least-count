import { afterEach, expect, it, vi } from 'vitest'
import { Directory, GameRoom } from './objects'
import { createRoom, join, start } from './room'
import type { RoomRecord } from './room'
import type { Env } from './types'
import { eraseRoomIdentity, erasureBlocked } from './erasure'
import { hash } from './http'
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
function memory(initial:Record<string,unknown>={}) {
  const values=new Map(Object.entries(initial));let queue=Promise.resolve<unknown>(undefined)
  const alarm=vi.fn(),ctx={blockConcurrencyWhile:(fn:()=>Promise<unknown>)=>{const p=queue.then(fn);queue=p.catch(()=>{});return p},getWebSockets:()=>[],storage:{get:async(key:string)=>structuredClone(values.get(key)),put:async(key:string|Record<string,unknown>,value:unknown)=>{if(typeof key==='string')values.set(key,structuredClone(value));else Object.entries(key).forEach(([k,v])=>values.set(k,structuredClone(v)))},delete:async(key:string)=>values.delete(key),list:async({prefix}:{prefix:string})=>new Map([...values].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)])),setAlarm:alarm,deleteAlarm:vi.fn()}} as unknown as DurableObjectState
  ctx.storage.transaction=async(fn:any)=>fn(ctx.storage)
  return {values,ctx,alarm,ready:()=>queue}
}
const request=(path:string,data:unknown)=>new Request(`https://internal${path}`,{method:'POST',body:JSON.stringify(data)})
function record(){const now=Date.now(),identity=(id:string)=>({id:`user:${id}`,displayName:id===uid?'Secret Owner':'Other Player',username:id===uid?'secretowner99':'otherplayer99',firstName:'Private',lastName:'Owner',avatarUrl:`https://example.test/${id}/avatar.png`,accountType:'registered' as const,expiresAt:now+3600000});const r=createRoom('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ABC234',identity(uid),{maxPlayers:2,eliminationThreshold:100,timedGame:true},now);join(r,identity(other),now);r.members.forEach(m=>m.connected=true);start(r,`user:${uid}`,now,()=>.6);return r}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
it('blocks active seats before deletion and anonymizes completed rooms without changing the game',async()=>{
  const r=record();expect(erasureBlocked(r,uid)).toBe(true);r.game!.phase='game-over';expect(erasureBlocked(r,uid)).toBe(false)
  const before=structuredClone(r.game!),otherBefore=structuredClone(r.members[1]);await eraseRoomIdentity(r,uid)
  const text=JSON.stringify(r);expect(text).not.toContain(uid);expect(text).not.toContain('Secret Owner');expect(text).not.toContain('secretowner99')
  expect(r.game!.players[0].hand).toEqual(before.players[0].hand);expect(r.game!.players.map(p=>p.score)).toEqual(before.players.map(p=>p.score));expect(r.game!.deadline).toBe(before.deadline);expect(r.game!.current).toBe(before.current);expect(r.members[1]).toEqual(otherBefore)
  const after=structuredClone(r);await eraseRoomIdentity(r,uid);expect(r).toEqual(after)
})
it('erases archived room snapshots, tickets and socket attachments, then stays erased after restart',async()=>{
  const r=record();r.status='closed';r.game!.phase='game-over'
  const h=memory({room:r,seen:[`action-${uid}`],['ticket:old']:{identity:{id:`user:${uid}`}}}),socket={serializeAttachment:vi.fn(),close:vi.fn(),readyState:3}
  h.ctx.getWebSockets=(()=>[socket]) as unknown as typeof h.ctx.getWebSockets
  const env={DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}')})}} as unknown as Env
  const room=new GameRoom(h.ctx,env);await h.ready()
  expect((await room.fetch(request('/account-erasure/erase',{uid}))).status).toBe(200)
  expect(JSON.stringify([...h.values])).not.toContain(uid);expect(h.values.has('ticket:old')).toBe(false);expect(socket.close).toHaveBeenCalledWith(4003,'Account deleted')
  const restart=new GameRoom(h.ctx,env);await h.ready();expect(await (await restart.fetch(request('/account-erasure/check',{uid}))).json()).toEqual({found:false})
})
it('durably retries failed steps, locks only the owner and cleans job identity on completion',async()=>{
  const h=memory(),env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_CAREER_KEY:'server-only',DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{"online":{}}')})}} as unknown as Env
  let directory=new Directory(h.ctx,env)
  const response=await directory.fetch(request('/erasure/start',{uid,namespace:'a'.repeat(32)})),{token}=await response.json() as {token:string}
  expect(await (await directory.fetch(request('/erasure/start',{uid,namespace:'a'.repeat(32)}))).json()).toEqual({token})
  expect(await (await directory.fetch(request('/erasure/locked',{uid}))).json()).toEqual({locked:true})
  expect(await (await directory.fetch(request('/erasure/locked',{uid:other}))).json()).toEqual({locked:false})
  await directory.alarm();expect(await (await directory.fetch(request('/erasure/status',{token}))).json()).toMatchObject({retrying:true})
  const key=`erasure-job:${await hash(token)}`,job=h.values.get(key) as Record<string,unknown>
  h.values.set(key,{...job,phase:'auth',nextAt:0});h.values.set(`member:user:${uid}`,{roomId:'old'})
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({user:{id:uid}}),{headers:{'Content-Type':'application/json'}})))
  directory=new Directory(h.ctx,env);await directory.alarm()
  expect(await (await directory.fetch(request('/erasure/status',{token}))).json()).toEqual({complete:true})
  expect(await (await directory.fetch(request('/erasure/locked',{uid}))).json()).toEqual({locked:false})
  expect(JSON.stringify([...h.values])).not.toContain(uid);expect(h.alarm).toHaveBeenCalled()
})

it('redacts unstructured legacy activity instead of retaining names in archived logs',async()=>{
  const r=record();r.status='closed';r.game!.events=[{id:'event-1',sequenceNumber:1,roundNumber:0,timestamp:0,type:'LEGACY_ACTIVITY',message:'Secret Owner drew a card.'}];r.game!.log=['Secret Owner drew a card.']
  await eraseRoomIdentity(r,uid);expect(JSON.stringify(r)).not.toContain('Secret Owner');expect(r.game!.events[0].type).toBe('LEGACY_ACTIVITY')
})
