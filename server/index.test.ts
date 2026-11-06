import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'
import type { Env } from './types'

const guest = {
  user: {
    player: {
      id: 'guest:test',
      displayName: 'Guest',
      avatarUrl: null,
      accountType: 'guest',
    },
    email: null,
    createdAt: '2026-01-01',
    lastActiveAt: '2026-01-01',
  },
  expiresAt: Date.now() + 60_000,
}
function environment(session: unknown = guest, enabled = false): Env {
  return {
    DIRECTORY: {
      idFromName: () => 'directory',
      get: () => ({
        fetch: async () =>
          new Response(JSON.stringify(session), {
            headers: { 'Content-Type': 'application/json' },
          }),
      }),
    },
    ...(enabled
      ? {
          CAREER_ENABLED: 'true',
          CAREER_ORIGIN: 'https://game.test',
          SUPABASE_CAREER_KEY: 'sb_secret_test_only',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        }
      : {}),
  } as unknown as Env
}
afterEach(() => vi.unstubAllGlobals())
describe('Worker career route responses', () => {
  it('returns disabled-feature errors as JSON instead of rejecting the Worker handler', async () => {
    const response = await worker.fetch(
      new Request('https://game.test/api/career?op=leaderboard'),
      environment(),
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('not enabled yet'),
    })
  })
  it('returns authentication and guest permission failures as JSON', async () => {
    const signedOut = await worker.fetch(
      new Request('https://game.test/api/career'),
      environment(null),
    )
    expect(signedOut.status).toBe(401)
    expect(await signedOut.json()).toMatchObject({
      error: expect.stringContaining('Sign in'),
    })
    const forbidden = await worker.fetch(
      new Request('https://game.test/api/career?op=buddies'),
      environment(guest, true),
    )
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toMatchObject({
      error: expect.stringContaining('verified account'),
    })
  })
  it('returns a missing migration error as JSON after the RPC rejects the operation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ code: 'PGRST202', message: 'Function not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const response = await worker.fetch(
      new Request('https://game.test/api/career?op=leaderboard'),
      environment(guest, true),
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('latest database migration'),
    })
  })
  it('keeps successful career responses unchanged', async () => {
    const ranking = { players: [], me: null, more: false }
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(ranking), {
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const response = await worker.fetch(
      new Request('https://game.test/api/career?op=leaderboard'),
      environment(guest, true),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(ranking)
  })
})
