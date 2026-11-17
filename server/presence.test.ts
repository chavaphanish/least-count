import {afterEach,expect,it,vi} from 'vitest'
import {presenceOperation,sweepPresence,presenceApi,clearPresence} from './presence'
import {hash} from './http'
import type {Env} from './types'
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333'
function memory(){const values=new Map<string,unknown>();let alarm:number|null=null;const storage={get:async(k:string)=>structuredClone(values.get(k)),put:async(k:string,v:unknown)=>{values.set(k,structuredClone(v))},delete:async(k:string)=>values.delete(k),list:async({prefix}:{prefix:string})=>new Map([...values].filter(([k])=>k.startsWith(prefix))),getAlarm:async()=>alarm,setAlarm:async(n:number)=>{alarm=n}} as unknown as DurableObjectStorage;return{values,storage}}
const result=async(s:DurableObjectStorage,now:number)=>await(await presenceOperation(s,'query',{ids:[uid,other]},now)).json() as {online:Record<string,number>}
afterEach(()=>vi.unstubAllGlobals())
it('aggregates independent authenticated sessions and expires exactly 60 seconds after activity',async()=>{
 const{storage,values}=memory(),a='a'.repeat(64),b='b'.repeat(64)
 await presenceOperation(storage,'heartbeat',{uid,session:a,expiresAt:200000,ids:[uid]},1000)
 await presenceOperation(storage,'heartbeat',{uid,session:b,expiresAt:200000},31000)
 expect((await result(storage,61000)).online).toEqual({[uid]:30000})
 await presenceOperation(storage,'leave',{uid,session:a,expiresAt:200000},62000)
 expect((await result(storage,62000)).online[uid]).toBe(29000)
 expect((await result(storage,91000)).online).toEqual({})
 await sweepPresence(storage,260001);expect(values.size).toBe(0)
})
it('clears only the signed-out session and rejects late heartbeats from that session',async()=>{
 const{storage}=memory(),a='a'.repeat(64),b='b'.repeat(64)
 await presenceOperation(storage,'heartbeat',{uid,session:a,expiresAt:200000},1000)
 await presenceOperation(storage,'heartbeat',{uid,session:b,expiresAt:200000},1000)
 await presenceOperation(storage,'leave',{uid,session:a,expiresAt:200000},2000)
 await expect(presenceOperation(storage,'heartbeat',{uid,session:a,expiresAt:200000},3000)).rejects.toMatchObject({status:403})
 expect((await result(storage,3000)).online[uid]).toBe(58000)
 await presenceOperation(storage,'leave',{uid,session:b,expiresAt:200000},4000)
 expect((await result(storage,4000)).online).toEqual({})
})
it('cleans expired storage, bounds status by token expiry and returns no private session fields',async()=>{
 const{storage,values}=memory();await presenceOperation(storage,'heartbeat',{uid,session:'a'.repeat(64),expiresAt:2000},1000)
 expect((await result(storage,1500)).online).toEqual({[uid]:500})
 expect(JSON.stringify(await result(storage,1500))).not.toMatch(/session|until|expires|token/)
 expect(JSON.stringify([...values])).not.toContain(uid)
 expect(await sweepPresence(storage,2000)).toBe(Infinity);expect(values.size).toBe(0)
})
it('account deletion clears all sessions and cannot be undone by delayed heartbeats',async()=>{
 const{storage}=memory();await presenceOperation(storage,'heartbeat',{uid,session:'a'.repeat(64),expiresAt:200000},1000)
 await presenceOperation(storage,'erase',{uid},2000);expect((await result(storage,2000)).online).toEqual({})
 await expect(presenceOperation(storage,'heartbeat',{uid,session:'a'.repeat(64),expiresAt:200000},3000)).rejects.toMatchObject({status:403})
})
function api(){
 const calls:{path:string;data:any}[]=[],env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async(path:string,init:RequestInit)=>{calls.push({path,data:JSON.parse(String(init.body))});return new Response(JSON.stringify({online:{}}))}})}} as unknown as Env
 const user={id:uid,email_confirmed_at:new Date().toISOString(),app_metadata:{},is_anonymous:false}
 const fetcher=vi.fn(async()=>new Response(JSON.stringify(user),{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetcher)
 const jwt=`a.${btoa(JSON.stringify({sub:uid,session_id:sid,exp:Date.now()/1000+3600}))}.c`
 const req=(data:unknown,token:string|null=jwt)=>new Request('https://game.test/api/presence',{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)})
 return{calls,env,user,fetcher,req,jwt}
}
it('authenticates heartbeats without profile RPCs and ignores client ownership/session claims',async()=>{
 const h=api();await presenceApi(h.req({heartbeat:true,ids:[uid],uid:other,session:'fake'}),h.env)
 expect(h.fetcher).toHaveBeenCalledTimes(1);expect(String(h.fetcher.mock.calls[0][0])).toContain('/auth/v1/user')
 expect(h.calls[0].data).toMatchObject({uid,session:await hash(`${uid}:${sid}`)})
 expect(JSON.stringify(h.calls)).not.toContain(h.jwt)
 await clearPresence(h.req({}),h.env,uid);expect(h.calls[1]).toMatchObject({path:'https://directory/presence/leave',data:{uid,session:await hash(`${uid}:${sid}`)}})
})
it('rejects unauthenticated, guest, unverified, revoked and deletion-pending heartbeats',async()=>{
 const h=api();await expect(presenceApi(h.req({heartbeat:true,ids:[]},null),h.env)).rejects.toMatchObject({status:401})
 for(const fields of [{is_anonymous:true},{email_confirmed_at:null},{app_metadata:{account_deletion_pending:true}}]){
  h.fetcher.mockImplementation(async()=>new Response(JSON.stringify({...h.user,...fields}),{headers:{'Content-Type':'application/json'}}))
  await expect(presenceApi(h.req({heartbeat:true,ids:[]}),h.env)).rejects.toMatchObject({status:403})
 }
 h.fetcher.mockImplementation(async()=>new Response(JSON.stringify({message:'revoked'}),{status:401,headers:{'Content-Type':'application/json'}}))
 await expect(presenceApi(h.req({heartbeat:true,ids:[]}),h.env)).rejects.toMatchObject({status:401});expect(h.calls).toHaveLength(0)
})
it('batches public lookups with no Auth/profile query and rejects oversized or invalid input',async()=>{
 const h=api();await presenceApi(h.req({heartbeat:false,ids:[uid,uid]},null),h.env)
 expect(h.fetcher).not.toHaveBeenCalled();expect(h.calls[0].data.ids).toEqual([uid])
 for(const ids of [[...Array(101)].map(()=>uid),['not-a-user']])await expect(presenceApi(h.req({heartbeat:false,ids}),h.env)).rejects.toMatchObject({status:400})
})
