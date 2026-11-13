import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameRoom } from './objects'
import { createRoom, join, start, reconcileHost } from './room'
import type { RoomRecord } from './room'
import type { Env } from './types'
import { HOST_TRANSFER_MS } from '../src/shared/multiplayer'

afterEach(() => vi.restoreAllMocks())
async function harness() {
  const now = Date.now(), ids = ['Alex', 'Ben', 'Cora', 'Drew']
  const identity = (id: string) => ({ id, displayName: id, avatarUrl: null, accountType: 'guest' as const, expiresAt: now + 3600000 })
  const r = createRoom('test-room', 'ABC234', identity(ids[0]), { maxPlayers: 4, eliminationThreshold: 100, timedGame: false }, now)
  ids.slice(1).forEach(id => join(r, identity(id), now))
  r.members.forEach(m => { m.connected = true; m.lastSeen = now; m.disconnectedAt = null })
  start(r, ids[0], now, () => .6)
  r.game!.phase = 'turn'; r.game!.sevens = null; r.game!.current = 1
  r.game!.players[0].eliminated = true; r.game!.players[0].hand = []
  reconcileHost(r, now)
  const storage = new Map<string, unknown>([['room', r], ['seen', []]])
  const messages = new Map<string, Record<string, unknown>[]>(ids.map(id => [id, []]))
  const sockets: { id: string; readyState: number; deserializeAttachment: () => unknown; send: (message: string) => void; close: () => void }[] = []
  function addSocket(id: string) {
    const socket = { id, readyState: 1, deserializeAttachment: () => ({ playerId: id, expiresAt: now + 3600000 }), send: (message: string) => messages.get(id)!.push(JSON.parse(message)), close: () => { socket.readyState = 3 } }
    sockets.push(socket)
    return socket as unknown as WebSocket
  }
  const ws = addSocket(ids[0]); ids.slice(1).forEach(addSocket)
  const alarms: number[] = []
  let queue = Promise.resolve<unknown>(undefined)
  const ctx = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => { const p = queue.then(fn); queue = p.catch(() => {}); return p },
    getWebSockets: (tag?: string) => sockets.filter(socket => !tag || socket.id === tag),
    storage: {
      get: async (key: string) => storage.get(key),
      put: async (data: Record<string, unknown>) => { for (const [key, value] of Object.entries(data)) storage.set(key, structuredClone(value)) },
      setAlarm: async (at: number) => { alarms.push(at) }, deleteAlarm: async () => {},
    },
  } as unknown as DurableObjectState
  const room = new GameRoom(ctx, {} as Env); await queue
  const restart = async () => { const restored = new GameRoom(ctx, {} as Env); await queue; return restored }
  return { room, restart, r, ws, addSocket, storage, messages, alarms, now }
}
describe('durable host handover', () => {
  it('broadcasts one confirmed transfer, deduplicates retries and preserves it after restart', async () => {
    const h = await harness(), token = h.r.hostTransfer!.id, before = structuredClone(h.r.game)
    const message = JSON.stringify({ type: 'action', requestId: 'handover', action: { type: 'transfer-host', transferId: token, targetId: 'Cora' } })
    await h.room.webSocketMessage(h.ws, message)
    await h.room.webSocketMessage(h.ws, message)
    const restored = await h.restart(); await restored.webSocketMessage(h.ws, message)
    const saved = h.storage.get('room') as RoomRecord
    expect(saved.hostId).toBe('Cora'); expect(saved.hostChange!.id).toBe(token); expect(saved.hostTransfer).toBeUndefined(); expect(saved.game).toEqual(before)
    for (const records of h.messages.values()) {
      const state = records.filter(m => m.type === 'state').at(-1)!.room as { hostId: string; hostChange: unknown }
      expect(state.hostId).toBe('Cora'); expect(state.hostChange).toMatchObject({ id: token, playerId: 'Cora' })
    }
    expect(h.messages.get('Alex')!.filter(m => m.type === 'ack')).toHaveLength(3)
  })
  it('persists pending deadlines across restart and applies automatic reassignment through the alarm', async () => {
    const h = await harness(), token = h.r.hostTransfer!.id
    await h.room.webSocketMessage(h.ws, JSON.stringify({ type: 'ping' }))
    expect(h.alarms).toContain(h.now + HOST_TRANSFER_MS)
    const restored = await h.restart()
    vi.spyOn(Date, 'now').mockReturnValue(h.now + HOST_TRANSFER_MS + 1)
    await restored.alarm()
    const saved = h.storage.get('room') as RoomRecord
    expect(saved.hostId).toBe('Ben'); expect(saved.hostChange!.id).toBe(token); expect(saved.hostTransfer).toBeUndefined()
  })
  it('broadcasts a deadline-triggered transfer even when it is detected by a heartbeat', async () => {
    const h = await harness()
    vi.spyOn(Date, 'now').mockReturnValue(h.now + HOST_TRANSFER_MS + 1)
    await h.room.webSocketMessage(h.ws, JSON.stringify({ type: 'ping' }))
    for (const records of h.messages.values()) expect((records.find(m => m.type === 'state')!.room as {hostId:string}).hostId).toBe('Ben')
  })
  it('broadcasts eligibility when an existing socket resumes heartbeats', async () => {
    const h = await harness()
    h.r.members[2].connected = false
    const candidate = h.addSocket('Cora')
    await h.room.webSocketMessage(candidate, JSON.stringify({ type: 'ping' }))
    const state = h.messages.get('Alex')!.find(m => m.type === 'state')!.room as { hostTransfer: { eligibleIds: string[] } }
    expect(state.hostTransfer.eligibleIds).toContain('Cora')
  })
  it('waits for the eliminated host’s last connection to close before falling back', async () => {
    const h = await harness(), second = h.addSocket('Alex'), token = h.r.hostTransfer!.id
    h.ws.close(); await h.room.webSocketClose(h.ws)
    expect((h.storage.get('room') as RoomRecord).hostTransfer!.id).toBe(token)
    second.close(); await h.room.webSocketClose(second)
    const saved = h.storage.get('room') as RoomRecord
    expect(saved.hostId).toBe('Ben'); expect(saved.hostChange!.id).toBe(token); expect(saved.members[0].left).toBe(false)
    await h.room.webSocketClose(second)
    expect((h.storage.get('room') as RoomRecord).hostChange).toEqual(saved.hostChange)
  })
})
