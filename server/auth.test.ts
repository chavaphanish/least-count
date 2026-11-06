import { afterEach, describe, expect, it, vi } from 'vitest'
import { authenticate, publicConfig, updateProfile } from './auth'
import type { Env } from './types'
const uid = '11111111-1111-4111-8111-111111111111'
const exp = Math.floor(Date.now() / 1000) + 3600
const token = `${btoa('{}')}.${btoa(JSON.stringify({ sub: uid, exp }))}.test`
const row = {
  id: uid,
  display_name: 'Verified Player',
  avatar_path: null as string | null,
  created_at: '2026-01-01T00:00:00Z',
  last_active_at: '2026-11-05T00:00:00Z',
}
const env = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
} as Env
const request = (data?: unknown) =>
  new Request('https://game.test/api/profile', {
    method: data ? 'PATCH' : 'GET',
    headers: { Authorization: `Bearer ${token}` },
    body: data ? JSON.stringify(data) : undefined,
  })
afterEach(() => {
  vi.unstubAllGlobals()
  row.avatar_path = null
})
function mockProvider(verified = true) {
  const calls: { url: string; method: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: options?.method ?? 'GET', body: options?.body })
      if (url.endsWith('/auth/v1/user'))
        return new Response(
          JSON.stringify({
            id: uid,
            aud: 'authenticated',
            created_at: '2025-12-01T00:00:00Z',
            email: 'private@example.com',
            email_confirmed_at: verified ? '2026-01-01T00:00:00Z' : null,
            user_metadata: { display_name: 'Verified Player' },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      if (url.includes('/rpc/ensure_player_profile'))
        return new Response(JSON.stringify([row]), {
          headers: { 'Content-Type': 'application/json' },
        })
      if (url.includes('/rest/v1/profiles'))
        return new Response(
          options?.method === 'PATCH' ? null : JSON.stringify(row),
          {
            status: options?.method === 'PATCH' ? 204 : 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      if (url.includes('/storage/v1/object/avatars'))
        return new Response(JSON.stringify({ Key: 'saved' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      throw new Error(`Unexpected mock endpoint ${url}`)
    }),
  )
  return calls
}
describe('provider-backed identity and profile authorization', () => {
  it('returns private email only in the authenticated account response and builds server identity without it', async () => {
    mockProvider()
    const auth = await authenticate(request(), env)
    expect(auth!.user.email).toBe('private@example.com')
    expect(auth!.user.createdAt).toBe('2025-12-01T00:00:00Z')
    expect(auth!.identity.id).toBe(`user:${uid}`)
    expect(auth!.identity.accountType).toBe('registered')
    expect('email' in auth!.identity).toBe(false)
  })
  it('rejects unverified email before loading a profile', async () => {
    const calls = mockProvider(false)
    await expect(authenticate(request(), env)).rejects.toMatchObject({
      status: 403,
      code: 'EMAIL_UNVERIFIED',
    })
    expect(calls.some((call) => call.url.includes('/rest/'))).toBe(false)
  })
  it('rejects invalid provider sessions rather than accepting JWT claims alone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'Invalid JWT' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    await expect(authenticate(request(), env)).rejects.toMatchObject({
      status: 401,
    })
  })
  it('loads profile data and updates only the verified owner', async () => {
    const calls = mockProvider()
    const result = await updateProfile(
      request({ displayName: 'New Name' }),
      env,
      { displayName: 'New Name' },
    )
    expect(result.player.id).toBe(`user:${uid}`)
    const patch = calls.find((call) => call.method === 'PATCH')!
    expect(patch.url).toContain(`id=eq.${uid}`)
    expect(JSON.parse(String(patch.body))).toEqual({ display_name: 'New Name' })
  })
  it('rejects attempted modification of another user before issuing an update', async () => {
    const calls = mockProvider()
    await expect(
      updateProfile(request({}), env, {
        displayName: 'Other',
        userId: 'victim',
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
  })
  it('uses a server-generated owner path and removes the replaced avatar', async () => {
    row.avatar_path = `${uid}/old.png`
    const calls = mockProvider()
    await updateProfile(
      new Request('https://game.test/api/profile/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'image/png',
        },
        body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      }),
      env,
    )
    const upload = calls.find(
      (c) => c.url.includes('/storage/') && c.method === 'POST',
    )!
    expect(upload.url).toMatch(new RegExp(`/avatars/${uid}/[a-f0-9-]+\\.png$`))
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toContain(`id=eq.${uid}`)
    expect(JSON.parse(String(patch.body)).avatar_path).toMatch(
      new RegExp(`^${uid}/[a-f0-9-]+\\.png$`),
    )
    const removed = calls.find((c) => c.method === 'DELETE')!
    expect(JSON.parse(String(removed.body)).prefixes).toEqual([
      `${uid}/old.png`,
    ])
  })
  it('rejects invalid image bytes before storage or profile changes', async () => {
    const calls = mockProvider()
    await expect(
      updateProfile(
        new Request('https://game.test/api/profile/avatar', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'image/png',
          },
          body: 'not an image',
        }),
        env,
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(
      calls.some((c) => c.url.includes('/storage/') || c.method === 'PATCH'),
    ).toBe(false)
  })
  it('will not publish secret/service-role configuration as a public browser key', () => {
    expect(() =>
      publicConfig({
        ...env,
        SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_expose',
      }),
    ).toThrow(/public/)
    const service = `${btoa('{}')}.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`
    expect(() =>
      publicConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: service }),
    ).toThrow(/service-role/)
  })
  it('offers guest mode when no Supabase project is configured', () =>
    expect(publicConfig({} as Env)).toEqual({ supabase: null }))
})

it('preserves the old photo when saving avatar removal fails',async()=>{
  row.avatar_path=`${uid}/old.png`
  const calls=mockProvider()
  const provider=globalThis.fetch
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo | URL,options?:RequestInit)=>{
    if(String(input).includes('/rest/v1/profiles') && options?.method==='PATCH')
      return new Response(JSON.stringify({message:'database unavailable'}),{status:500,headers:{'Content-Type':'application/json'}})
    return provider(input,options)
  }))
  await expect(updateProfile(new Request('https://game.test/api/profile/avatar',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}}),env)).rejects.toMatchObject({status:503})
  expect(calls.some(call=>call.method==='DELETE')).toBe(false)
  expect(row.avatar_path).toBe(`${uid}/old.png`)
})
