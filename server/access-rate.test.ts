import {afterEach,it,expect,vi} from 'vitest'
import {Directory} from './objects'
import worker from './index'
import type {Env} from './types'
afterEach(()=>vi.useRealTimers())
it('serializes per-client attempts, caps limits and expires only rate-limit state',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-11T18:00:00Z'))
 const storage=new Map<string,unknown>();let queue=Promise.resolve()
 const context={storage:{get:async(k:string)=>structuredClone(storage.get(k)),put:async(k:string,v:unknown)=>{storage.set(k,structuredClone(v))},delete:async(k:string)=>storage.delete(k),setAlarm:vi.fn(async()=>{})},blockConcurrencyWhile:(fn:()=>Promise<unknown>)=>{const run=queue.then(fn);queue=run.then(()=>{});return run}}
 const directory=new Directory(context as unknown as DurableObjectState,{} as Env)
 const attempt=()=>directory.fetch(new Request('https://directory/access-limit',{method:'POST',body:JSON.stringify({limit:99999})}))
 const responses=await Promise.all(Array.from({length:20},attempt));expect(responses.filter(r=>r.ok)).toHaveLength(12);expect(responses.filter(r=>r.status===429)).toHaveLength(8)
 storage.set('unrelated','preserved');vi.setSystemTime(new Date('2026-11-11T18:06:00Z'));await directory.alarm();expect(storage.has('access-rate')).toBe(false);expect(storage.get('unrelated')).toBe('preserved');expect((await attempt()).ok).toBe(true)
})
it('rejects cross-origin credential requests before parsing or resolving account data',async()=>{
 const result=await worker.fetch(new Request('https://game.test/api/auth/login',{method:'POST',headers:{Origin:'https://other.test'},body:JSON.stringify({identifier:'knownuser99',password:'do-not-return'})}),{} as Env)
 expect(result.status).toBe(403);expect(await result.text()).not.toContain('do-not-return');expect(result.headers.get('Cache-Control')).toBe('no-store')
})
