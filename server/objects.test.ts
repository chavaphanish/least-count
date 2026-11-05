import { describe, expect, it } from 'vitest'
import { GameRoom } from './objects'
import { createRoom, join, start, view } from './room'
import type { Env } from './types'
import { createCard } from '../src/game/cards'

async function harness(seven = false) {
  const now = Date.now()
  const identity = (id: string) => ({
    id,
    displayName: id,
    avatarUrl: null,
    accountType: 'guest' as const,
    expiresAt: now + 3600000,
  })
  const r = createRoom(
    'test-room',
    'ABC234',
    identity('Alex'),
    { maxPlayers: 2, eliminationThreshold: 100, timedGame: false },
    now,
  )
  join(r, identity('Ben'), now)
  r.members.forEach((m) => {
    m.connected = true
    m.lastSeen = now
  })
  start(r, 'Alex', now, () => 0.6)
  const g = r.game!
  g.current = 0
  g.discards = [[{ ...createCard('clubs', '3'), id: 'old-public' }]]
  g.eligible = []
  g.players[0].hand = [
    { ...createCard('hearts', seven ? '7' : 'K'), id: 'played-public' },
    { ...createCard('clubs', 'Q'), id: 'own-private' },
  ]
  g.players[1].hand = [{ ...createCard('spades', '7'), id: 'opponent-private' }]
  g.events = []
  g.eventSequence = 0
  g.log = []
  const storage = new Map<string, unknown>([
    ['room', r],
    ['seen', []],
  ])
  const messages: unknown[] = []
  const ws = {
    readyState: 1,
    deserializeAttachment: () => ({
      playerId: 'Alex',
      expiresAt: now + 3600000,
    }),
    send: (message: string) => messages.push(JSON.parse(message)),
    close: () => {},
  }
  const initial: Promise<unknown>[] = []
  const ctx = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => {
      const p = fn()
      initial.push(p)
      return p
    },
    getWebSockets: () => [ws],
    storage: {
      get: async (key: string) => storage.get(key),
      put: async (data: Record<string, unknown>) => {
        Object.entries(data).forEach(([key, value]) =>
          storage.set(key, structuredClone(value)),
        )
      },
      setAlarm: async () => {},
      deleteAlarm: async () => {},
    },
  } as unknown as DurableObjectState
  const room = new GameRoom(ctx, {} as Env)
  await Promise.all(initial)
  return { room, ws: ws as unknown as WebSocket, storage, messages, r }
}
describe('durable action commits and retries', () => {
  it.each([false, true])(
    'deduplicates an accepted socket request and restores its public history (seven=%s)',
    async (seven) => {
      const { room, ws, storage, messages, r } = await harness(seven)
      const message = JSON.stringify({
        type: 'action',
        requestId: 'same-request',
        action: { type: 'discard', cardIds: ['played-public'] },
      })
      await room.webSocketMessage(ws, message)
      const once = structuredClone(storage.get('room')) as typeof r
      await room.webSocketMessage(ws, message)
      const twice = storage.get('room') as typeof r
      expect(twice.game).toEqual(once.game)
      expect(twice.game!.events).toHaveLength(1)
      expect(twice.game!.events![0].type).toBe(
        seven ? 'POWER_SEVEN_PLAYED' : 'TURN_COMPLETED',
      )
      expect(view(twice, 'Ben', Date.now()).game!.events).toEqual(
        once.game!.events,
      )
      expect(JSON.stringify(once.game!.events)).not.toContain('own-private')
      expect(JSON.stringify(once.game!.events)).not.toContain(
        'opponent-private',
      )
      expect(
        messages.filter((m) => (m as { type: string }).type === 'ack'),
      ).toHaveLength(2)
    },
  )
  it('does not create events for rejected or unauthorized actions', async () => {
    const { room, ws, storage, r } = await harness()
    await room.webSocketMessage(
      ws,
      JSON.stringify({
        type: 'action',
        requestId: 'bad',
        action: { type: 'discard', cardIds: ['opponent-private'] },
      }),
    )
    expect((storage.get('room') as typeof r).game!.events).toEqual([])
  })
})
