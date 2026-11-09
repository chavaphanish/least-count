import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker(online = true) {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {}
  const cache = vi.fn()
  const fetcher = vi.fn(async () => {
    if (!online) throw new Error('offline')
    return new Response('fresh deployment')
  })
  const skipWaiting = vi.fn(async () => {})
  const claim = vi.fn(async () => {})
  runInNewContext(readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8'), {
    self: { location: {origin:'https://game.test'}, clients:{claim}, skipWaiting, addEventListener:(type:string, handler:typeof handlers[string]) => {handlers[type] = handler} },
    fetch: fetcher, Response, URL, caches: {open:cache},
  })
  return {handlers, cache, fetcher, skipWaiting, claim}
}
describe('network-only PWA worker', () => {
  it('always requests fresh navigation HTML and never opens a cache', async () => {
    const sw = worker()
    let response: Promise<Response> | undefined
    const request = {url:'https://game.test/join/ABCDEF',method:'GET',mode:'navigate'}
    sw.handlers.fetch({request,respondWith:(value:Promise<Response>) => {response=value}})
    expect(await (await response!).text()).toBe('fresh deployment')
    expect(sw.fetcher).toHaveBeenCalledWith(request)
    expect(sw.cache).not.toHaveBeenCalled()
  })
  it('returns a noncached connection message without reflecting private callback parameters when offline', async () => {
    const sw = worker(false)
    let response: Promise<Response> | undefined
    sw.handlers.fetch({request:{url:'https://game.test/auth/callback?code=private-token',method:'GET',mode:'navigate'},respondWith:(value:Promise<Response>) => {response=value}})
    const result = await response!
    expect(result.status).toBe(503)
    expect(result.headers.get('Cache-Control')).toBe('no-store')
    const html = await result.text()
    expect(html).toContain('Connection required')
    expect(html).not.toContain('private-token')
    expect(sw.cache).not.toHaveBeenCalled()
  })
  it.each([
    {url:'https://game.test/api/session',method:'GET',mode:'navigate'},
    {url:'https://game.test/api/profile',method:'PATCH',mode:'cors'},
    {url:'https://game.test/api/rooms/ABCDEF/ws',method:'GET',mode:'websocket'},
    {url:'https://game.test/assets/index-hash.js',method:'GET',mode:'cors'},
    {url:'https://provider.test/auth',method:'GET',mode:'navigate'},
  ])('does not intercept private/API/socket/asset/provider requests: $url', request => {
    const sw = worker()
    const respondWith = vi.fn()
    sw.handlers.fetch({request,respondWith})
    expect(respondWith).not.toHaveBeenCalled()
    expect(sw.fetcher).not.toHaveBeenCalled()
    expect(sw.cache).not.toHaveBeenCalled()
  })
  it('waits for explicit update acceptance and claims clients without reloading them', async () => {
    const sw = worker()
    const waitUntil = vi.fn()
    expect(sw.skipWaiting).not.toHaveBeenCalled()
    sw.handlers.message({data:{type:'OTHER'},waitUntil})
    expect(sw.skipWaiting).not.toHaveBeenCalled()
    sw.handlers.message({data:{type:'ACTIVATE_UPDATE'},waitUntil})
    expect(sw.skipWaiting).toHaveBeenCalledOnce()
    sw.handlers.activate({waitUntil})
    expect(sw.claim).toHaveBeenCalledOnce()
  })
})
