import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {PresenceClient,presenceId} from './client'
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(0);vi.stubGlobal('IntersectionObserver',undefined)})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
const settle=()=>vi.advanceTimersByTimeAsync(0)
it('uses one 30-second heartbeat loop across duplicate avatars without assuming login means online',async()=>{
 const read=vi.fn(async(ids:string[])=>({online:Object.fromEntries(ids.map(id=>[id,60000]))})),client=new PresenceClient(read,uid,()=>Date.now())
 client.watch({} as Element,uid);client.watch({} as Element,uid);client.watch({} as Element,other)
 expect(client.isOnline(uid)).toBe(false);client.start();await settle();expect(read).toHaveBeenCalledTimes(1)
 expect(read.mock.calls[0][0]).toEqual([uid,other]);expect(client.isOnline(uid)).toBe(true);expect(vi.getTimerCount()).toBe(1)
 await vi.advanceTimersByTimeAsync(30000);expect(read).toHaveBeenCalledTimes(2);client.stop();await vi.advanceTimersByTimeAsync(60000);expect(read).toHaveBeenCalledTimes(2)
})
it('expires indicators after silence even when networking fails, and resumes immediately on visibility',async()=>{
 let fail=false;const read=vi.fn(async()=>{if(fail)throw new Error('offline');return{online:{[uid]:60000}}}),client=new PresenceClient(read,uid,()=>Date.now())
 client.start();await settle();fail=true;await vi.advanceTimersByTimeAsync(59999);expect(client.isOnline(uid)).toBe(true)
 await vi.advanceTimersByTimeAsync(1);expect(client.isOnline(uid)).toBe(false)
 client.setVisible(false);const count=read.mock.calls.length;await vi.advanceTimersByTimeAsync(60000);expect(read).toHaveBeenCalledTimes(count)
 fail=false;client.setVisible(true);await settle();expect(client.isOnline(uid)).toBe(true);client.stop()
})
it('batches observed IDs, sends only one heartbeat across chunks and never runs overlapping requests',async()=>{
 let resolve:(value:{online:Record<string,number>})=>void=()=>{}
 const read=vi.fn((_ids:string[],_heartbeat:boolean,_signal:AbortSignal)=>new Promise<{online:Record<string,number>}>(done=>{resolve=done})),client=new PresenceClient(read,uid,()=>Date.now())
 for(let n=1;n<=205;n++)client.watch({} as Element,`${n.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111`)
 client.start();await settle();expect(read).toHaveBeenCalledTimes(1)
 client.watch({} as Element,other);await settle();expect(read).toHaveBeenCalledTimes(1)
 resolve({online:{}});await settle();expect(read).toHaveBeenCalledTimes(2)
 expect(read.mock.calls[0]).toMatchObject({0:expect.any(Array),1:true});expect(read.mock.calls[1]).toMatchObject({0:expect.any(Array),1:false});client.stop();resolve({online:{}});await settle()
})
it('supports Strict Mode effect replay and aborts old work without duplicate timers',async()=>{
 const read=vi.fn(async(_ids:string[],_heartbeat:boolean,_signal:AbortSignal)=>({online:{[uid]:60000}})),client=new PresenceClient(read,uid,()=>Date.now())
 client.start();client.stop();client.start();await settle();expect(read).toHaveBeenCalledTimes(1);expect(read.mock.calls[0][2].aborted).toBe(false)
 await vi.advanceTimersByTimeAsync(30000);expect(read).toHaveBeenCalledTimes(2);client.stop()
})
it('keeps guest and bot avatars offline and canonicalizes registered public identities',()=>{
 expect(presenceId({id:`user:${uid}`,accountType:'registered'})).toBe(uid)
 expect(presenceId({id:uid})).toBe(uid)
 expect(presenceId({id:uid,accountType:'guest'})).toBeNull()
 expect(presenceId({id:'bot:1'})).toBeNull()
})
it('queries only intersecting avatars through one shared observer',async()=>{
 let callback:IntersectionObserverCallback=()=>{}
 const observe=vi.fn(),unobserve=vi.fn(),disconnect=vi.fn()
 const Observer=vi.fn(function(this:any,fn:IntersectionObserverCallback){callback=fn;Object.assign(this,{observe,unobserve,disconnect})})
 vi.stubGlobal('IntersectionObserver',Observer)
 const read=vi.fn(async(_ids:string[])=>({online:{[other]:60000}})),client=new PresenceClient(read,null,()=>Date.now()),a={} as Element,b={} as Element
 const remove=client.watch(a,other);client.watch(b,uid);client.start();await settle();expect(read).not.toHaveBeenCalled()
 callback([{target:a,isIntersecting:true}] as unknown as IntersectionObserverEntry[],{} as IntersectionObserver);await settle()
 expect(read.mock.calls[0][0]).toEqual([other]);expect(Observer).toHaveBeenCalledTimes(1);remove();expect(unobserve).toHaveBeenCalledWith(a);client.stop();expect(disconnect).toHaveBeenCalled()
})
