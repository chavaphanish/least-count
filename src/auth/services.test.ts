import { describe, expect, it, vi } from 'vitest'
import { initialize, Services, ServiceError } from './services'
import type { StartupAdapter } from './services'
const adapter = (session: unknown = null): StartupAdapter => ({
  config: vi.fn(async () => ({ supabase: null, service: 'least-count' })),
  configure: vi.fn(),
  restore: vi.fn(async () => null),
  session: vi.fn(async () => ({ user: session as never, room: null })),
})
describe('initialization', () => {
  it.each([
    null,
    { player: { id: 'guest:1', accountType: 'guest', displayName: 'Guest' } },
    {
      player: {
        id: 'user:1',
        accountType: 'registered',
        displayName: 'Player',
      },
    },
  ])(
    'restores the returned registered, guest, or unauthenticated session',
    async (user) => {
      const steps: number[] = []
      const a = adapter(user)
      const result = await initialize(
        a,
        (step) => steps.push(step),
        new AbortController().signal,
      )
      expect(result.user).toEqual(user)
      expect(steps).toEqual([0, 1, 2, 3, 4])
      expect(a.restore).toHaveBeenCalledOnce()
    },
  )
  it('stops after a backend or auth failure instead of displaying ready', async () => {
    const a = adapter()
    a.restore = vi.fn(async () => {
      throw new Error('Session unavailable')
    })
    const stages: number[] = []
    await expect(
      initialize(a, (step) => stages.push(step), new AbortController().signal),
    ).rejects.toThrow('Session unavailable')
    expect(stages).not.toContain(4)
    expect(a.session).not.toHaveBeenCalled()
  })
  it('rejects aborted initialization before requesting a profile', async () => {
    const a = adapter()
    const c = new AbortController()
    c.abort()
    await expect(initialize(a, () => {}, c.signal)).rejects.toThrow(/timed out/)
    expect(a.session).not.toHaveBeenCalled()
  })
  it('returns provider validation errors without turning them into signed-in users', async () => {
    const a = adapter()
    a.session = vi.fn(async () => {
      throw new ServiceError('Verify email', 403, 'EMAIL_UNVERIFIED')
    })
    await expect(
      initialize(a, () => {}, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'EMAIL_UNVERIFIED' })
  })
  it('reports an unavailable backend instead of interpreting an HTML page as a session', async () => {
    const original = globalThis.fetch
    globalThis.fetch = vi.fn(async () => new Response('<html>app</html>'))
    try {
      await expect(new Services().api('/session')).rejects.toThrow(
        /backend is unavailable/,
      )
    } finally {
      globalThis.fetch = original
    }
  })
})
