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
    ROOMS: {
      idFromName: () => 'room',
      get: () => ({
        fetch: async () =>
          new Response(JSON.stringify({ ok: true }), {
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
describe('Worker guest multiplayer gate', () => {
  const origin = { headers: { Origin: 'https://game.test' } }
  it('advertises the effective flag through /api/config', async () => {
    const disabled = await worker.fetch(
      new Request('https://game.test/api/config'),
      environment(),
    )
    expect(await disabled.json()).toMatchObject({
      guestMultiplayerEnabled: false,
    })
    const env = environment()
    env.GUEST_MULTIPLAYER_ENABLED = 'true'
    const enabled = await worker.fetch(
      new Request('https://game.test/api/config'),
      env,
    )
    expect(await enabled.json()).toMatchObject({
      guestMultiplayerEnabled: true,
    })
  })
  it('blocks guests from creating rooms with the exact notice', async () => {
    const response = await worker.fetch(
      new Request('https://game.test/api/rooms', {
        method: 'POST',
        ...origin,
      }),
      environment(),
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: 'Multiplayer Online Mode for Guests is currently under testing. Please sign up or sign in to play online.',
    })
  })
  it('blocks guests from joining, viewing and starting rooms', async () => {
    for (const operation of ['join', 'start', 'ticket']) {
      const response = await worker.fetch(
        new Request(`https://game.test/api/rooms/ABC234/${operation}`, {
          method: 'POST',
          ...origin,
        }),
        environment(),
      )
      expect(response.status, operation).toBe(403)
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining('under testing'),
      })
    }
    const view = await worker.fetch(
      new Request('https://game.test/api/rooms/ABC234', {
        headers: origin.headers,
      }),
      environment(),
    )
    expect(view.status).toBe(403)
  })
  it('still lets guests leave a room so they can exit gracefully', async () => {
    const response = await worker.fetch(
      new Request('https://game.test/api/rooms/ABC234/leave', {
        method: 'POST',
        ...origin,
      }),
      environment(),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  })
  it('admits guests when the Worker variable re-enables multiplayer', async () => {
    const env = environment()
    env.GUEST_MULTIPLAYER_ENABLED = 'true'
    // Past the gate, the empty settings body fails validation instead.
    const response = await worker.fetch(
      new Request('https://game.test/api/rooms', {
        method: 'POST',
        ...origin,
      }),
      env,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.not.stringContaining('under testing'),
    })
  })
})
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
