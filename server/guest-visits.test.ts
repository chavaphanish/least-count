import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it, vi } from 'vitest'
import {
  guestOperation,
  sweepGuestVisits,
  visitorMetadata,
} from './guest-visits'
import { hash } from './http'
import worker from './index'
import type { Env } from './types'

function harness() {
  const db = new DatabaseSync(':memory:'),
    kv = new Map<string, unknown>()
  const storage = {
    sql: {
      exec(query: string, ...args: (number | string | null)[]) {
        if (query.startsWith('CREATE TABLE')) {
          db.exec(query)
          return
        }
        const rows = db.prepare(query).all(...args)
        return { toArray: () => rows, one: () => rows[0] }
      },
    },
    kv: {
      get: (k: string) => kv.get(k),
      put: (k: string, v: unknown) => kv.set(k, v),
      delete: (k: string) => kv.delete(k),
      list: () => [],
    },
    getAlarm: async () => null,
    setAlarm: async () => {},
    transactionSync(fn: () => unknown) {
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  } as unknown as DurableObjectStorage
  const env = {} as Env
  const call = async (path: string, data: Record<string, unknown> = {}) =>
    (await guestOperation(storage, env, path, data)).json()
  return { db, kv, call, storage, env }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('assigns distinct active handles even on collision and requires the secret cookie for restoration', async () => {
  const h = harness()
  const random = crypto.getRandomValues.bind(crypto)
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((a) =>
    a instanceof Uint32Array ? a.fill(12345) : random(a),
  )
  const first = await h.call('/guest'),
    second = await h.call('/guest')
  expect(first.user.player.username).toMatch(/^guest[1-9]\d{4}$/)
  expect(second.user.player.username).not.toBe(first.user.player.username)
  expect(
    await h.call('/session', { token: first.user.player.username }),
  ).toBeNull()
  expect((await h.call('/guest', { token: first.token })).user).toMatchObject({
    player: first.user.player,
  })
  await h.call('/session', { token: first.token })
  expect(await h.call('/guest-stats')).toMatchObject({
    totalVisits: 2,
    uniqueSessions: 2,
    activeGuests: 2,
  })
  await h.call('/logout', { token: first.token })
  expect(await h.call('/session', { token: first.token })).toBeNull()
  expect(await h.call('/guest-stats')).toMatchObject({
    totalVisits: 2,
    activeGuests: 1,
  })
  expect(
    h.db
      .prepare('SELECT status FROM guest_visits WHERE id=?')
      .get(first.user.player.id)?.status,
  ).toBe('logged_out')
})

it('expires abandoned accounts at the deadline, preserves duration, then removes IP, device and history', async () => {
  vi.useFakeTimers()
  const now = Date.now(),
    day = 86400000,
    h = harness()
  const guest = await h.call('/guest', {
    ip: '192.0.2.9',
    device: 'Tablet',
    browser: 'Safari',
    os: 'iOS',
  })
  vi.setSystemTime(now + 20 * 60000)
  await h.call('/session', { token: guest.token })
  vi.setSystemTime(now + 45 * 60000)
  await h.call('/session', { token: guest.token, observe: true })
  vi.setSystemTime(now + 51 * 60000)
  expect(await h.call('/session', { token: guest.token })).toBeNull()
  const record = () => h.db.prepare('SELECT * FROM guest_visit_history').get()
  expect(record()).toMatchObject({
    ended: now + 50 * 60000,
    duration_ms: 50 * 60000,
    status: 'expired',
  })
  const stats = await h.call('/guest-stats')
  expect(stats).toMatchObject({
    activeGuests: 0,
    byDevice: [{ value: 'Tablet', visits: 1 }],
  })
  expect(JSON.stringify(stats)).not.toContain('192.0.2.9')
  sweepGuestVisits(h.storage, now + day, h.env)
  expect(record()).toMatchObject({ ip: null, device: 'Tablet' })
  sweepGuestVisits(h.storage, now + 30 * day, h.env)
  expect(record()).toMatchObject({ browser: null, device: null, os: null })
  sweepGuestVisits(h.storage, now + 91 * day, h.env)
  expect(record()).toBeUndefined()
})

it('upgrades an existing cookie without changing the seat ID or creating a visit on each refresh', async () => {
  const h = harness(),
    token = 'a'.repeat(64),
    started = new Date().toISOString()
  const key = 'session:' + (await hash(token))
  h.kv.set(key, {
    expiresAt: Date.now() + 3600000,
    user: {
      player: { id: 'guest:original', displayName: 'Visitor' },
      createdAt: started,
    },
  })
  const guest = await h.call('/session', { token })
  expect(guest.user.player).toMatchObject({
    id: 'guest:original',
    displayName: 'Visitor',
    username: expect.stringMatching(/^guest\d{5}$/),
  })
  expect(h.kv.has(key)).toBe(false)
  expect(await h.call('/session', { token })).toMatchObject({
    user: { player: guest.user.player },
  })
  expect(await h.call('/guest-stats')).toMatchObject({ totalVisits: 1 })
})

it('requires opt-in, honors GPC, and ignores forwarded client IPs', () => {
  const request = new Request('https://game.test', {
    headers: {
      'User-Agent': 'Mozilla iPad Safari/1',
      'X-Forwarded-For': '203.0.113.8',
    },
  })
  expect(visitorMetadata(request, false)).toEqual({})
  expect(visitorMetadata(request, true)).toEqual({
    ip: null,
    device: 'Tablet',
    browser: 'Safari',
    os: 'iOS',
  })
  request.headers.set('Sec-GPC', '1')
  expect(visitorMetadata(request, true)).toEqual({})
})

it('keeps statistics unavailable without an operator credential', async () => {
  const response = await worker.fetch(
    new Request('https://game.test/api/admin/guest-stats'),
    {} as Env,
  )
  expect(response.status).toBe(403)
})
