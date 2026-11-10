import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkUsername } from './identity'
import type { Env } from './types'
const env = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
} as Env
afterEach(() => vi.unstubAllGlobals())
describe('public username availability endpoint', () => {
  it('returns only a canonical public username and boolean, without email or profile data', async () => {
    const fetch = vi.fn(async (_url: unknown, options?: RequestInit) => {
      expect(JSON.parse(String(options?.body))).toEqual({
        candidate: 'cardmaster99',
      })
      return new Response('true', {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetch)
    expect(
      await checkUsername(
        new Request('https://game.test/api/username?username=CardMaster99'),
        env,
      ),
    ).toEqual({ username: 'cardmaster99', available: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects invalid format before querying the database', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      checkUsername(
        new Request('https://game.test/api/username?username=too_short'),
        env,
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('fails closed if the migration is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'PGRST202' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    await expect(
      checkUsername(
        new Request('https://game.test/api/username?username=ValidUser123'),
        env,
      ),
    ).rejects.toMatchObject({ status: 503, code: 'IDENTITY_UNAVAILABLE' })
  })
})
