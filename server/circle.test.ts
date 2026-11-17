import { beforeEach, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { circleGames, searchCircle } from './circle'
import type { Env } from './types'
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
const uid = '11111111-1111-4111-8111-111111111111'
const env = { SUPABASE_CAREER_KEY: 'server-only' } as Env
const url = 'https://example.supabase.co'
let query: any
beforeEach(() => {
  vi.resetAllMocks()
  query = { data: [], error: null }
  for (const method of ['select', 'ilike', 'neq', 'order', 'limit', 'eq', 'in']) query[method] = vi.fn(() => query)
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => query) } as never)
})
it('uses a bounded case-insensitive literal username substring, excluding self and private fields', async () => {
  query.data = [{ username: 'Some_CardMaster' }, { username: 'blocked' }]
  const rpc = vi.fn(async (_: string, { args }: any) => args.username === 'blocked'
    ? { error: { code: 'P0001' }, data: null }
    : { error: null, data: { profile: { id: 'other', username: args.username, xp: 123 }, relationship: 'incoming', private: 'never-return' } })
  const result = await searchCircle({ rpc } as unknown as SupabaseClient, env, url, uid, '@MaST_%\\')
  expect(query.ilike).toHaveBeenCalledWith('username', '%MaST\\_\\%\\\\%')
  expect(query.neq).toHaveBeenCalledWith('id', uid)
  expect(query.select).toHaveBeenCalledWith('username')
  expect(query.limit).toHaveBeenCalledWith(20)
  expect(rpc).toHaveBeenCalledWith('career_api', { operation: 'public', args: { username: 'Some_CardMaster' } })
  expect(result).toEqual([{ id: 'other', username: 'Some_CardMaster', xp: 123, relationship: 'incoming' }])
  expect(JSON.stringify(result)).not.toMatch(/never-return|server-only/)
})
it('validates search length without touching the database and propagates retryable failures', async () => {
  const client = { rpc: vi.fn() } as unknown as SupabaseClient
  expect(await searchCircle(client, env, url, uid, 'a')).toEqual([])
  await expect(searchCircle(client, env, url, uid, 'a'.repeat(65))).rejects.toMatchObject({ status: 400 })
  expect(createClient).not.toHaveBeenCalled()
  query.error = { message: 'failed' }
  await expect(searchCircle(client, env, url, uid, 'smith')).rejects.toMatchObject({ status: 503 })
  query.error = null; query.data = [{ username: 'smith' }]
  vi.mocked(client.rpc).mockResolvedValue({ error: { code: '08006' } } as never)
  await expect(searchCircle(client, env, url, uid, 'smith')).rejects.toMatchObject({ status: 503 })
})
it('loads counts for all accepted friends before top-ten selection, scoped to the authenticated owner', async () => {
  const players = Array.from({ length: 12 }, (_, i) => ({ id: `friend${i}`, relationship: 'accepted' }))
  players.push({ id: 'pending', relationship: 'incoming' })
  query.data = [{ opponent_id: 'friend11', games: 55 }, { opponent_id: 'friend0', games: 3 }]
  const result = await circleGames(env, url, uid, players)
  expect(query.eq).toHaveBeenCalledWith('user_id', uid)
  expect(query.in).toHaveBeenCalledWith('opponent_id', players.slice(0, 12).map(p => p.id))
  expect(result[11].gamesTogether).toBe(55)
  expect(result[1].gamesTogether).toBe(0)
  expect(result[12].gamesTogether).toBe(0)
  query.error = { message: 'failed' }
  await expect(circleGames(env, url, uid, players)).rejects.toMatchObject({ status: 503 })
})
it('avoids opponent lookups when there are no accepted friends', async () => {
  expect(await circleGames(env, url, uid, [{ id: 'pending', relationship: 'incoming' }])).toEqual([{ id: 'pending', relationship: 'incoming' }])
  expect(createClient).not.toHaveBeenCalled()
})
