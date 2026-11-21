import { describe, expect, it } from 'vitest'
import { createRoom, gameAction, join, leave, start, updateLobbySettings, view } from './room'
import { DEFAULT_ROOM_SETTINGS, HEARTBEAT_MS } from '../src/shared/multiplayer'
import type { Identity } from './types'
const now = 1000
const person = (id: string): Identity => ({ id, displayName: id, avatarUrl: null, accountType: 'guest', expiresAt: 1000000 })
function lobby(count = 1) {
  const room = createRoom('room', 'ABC234', person('host'), DEFAULT_ROOM_SETTINGS, now)
  for (let i = 1; i < count; i++) join(room, person(`friend${i}`), now)
  room.members.forEach(member => { member.connected = true; member.lastSeen = now; member.disconnectedAt = null })
  return room
}
describe('authoritative waiting-lobby settings', () => {
  it.each([2, 8])('updates capacity %i and threshold without changing seats or timer', count => {
    const room = lobby(2), members = structuredClone(room.members)
    gameAction(room, 'host', { type: 'update-settings', settings: { maxPlayers: count, eliminationThreshold: 250 } }, now)
    expect(room.settings).toEqual({ ...DEFAULT_ROOM_SETTINGS, maxPlayers: count, eliminationThreshold: 250 })
    expect(room.members).toEqual(members)
    expect(room.game).toBeNull()
    expect(view(room, 'friend1', now).settings).toEqual(room.settings)
  })
  it.each([50, 100, 150, 200, 250])('accepts threshold %i', eliminationThreshold => {
    const room = lobby(); updateLobbySettings(room, 'host', { eliminationThreshold }, now)
    expect(room.settings.eliminationThreshold).toBe(eliminationThreshold)
  })
  it.each([null, {}, { maxPlayers: 1 }, { maxPlayers: 9 }, { maxPlayers: 2.5 }, { eliminationThreshold: 99 }, { timedGame: false }, { hostId: 'friend1' }])('rejects invalid settings atomically: %j', settings => {
    const room = lobby(), before = structuredClone(room)
    expect(() => gameAction(room, 'host', { type: 'update-settings', settings }, now)).toThrow()
    expect(room).toEqual(before)
  })
  it('rejects a non-host and disconnected, stale or expired host', () => {
    const room = lobby(2)
    expect(() => updateLobbySettings(room, 'friend1', { maxPlayers: 3 }, now)).toThrow('Only the host')
    room.members[0].connected = false
    expect(() => updateLobbySettings(room, 'host', { maxPlayers: 3 }, now)).toThrow('Reconnect')
    room.members[0].connected = true
    expect(() => updateLobbySettings(room, 'host', { maxPlayers: 3 }, now + HEARTBEAT_MS)).toThrow('Reconnect')
    room.members[0].authExpiresAt = now
    expect(() => updateLobbySettings(room, 'host', { maxPlayers: 3 }, now)).toThrow('Reconnect')
  })
  it('preserves disconnected reservations, allows shrinking after a player leaves', () => {
    const room = lobby(3), members = structuredClone(room.members)
    room.members[2].connected = false
    expect(() => updateLobbySettings(room, 'host', { maxPlayers: 2 }, now)).toThrow('occupied or reserved')
    expect(room.members.map(m => m.id)).toEqual(members.map(m => m.id))
    leave(room, 'friend2', now)
    updateLobbySettings(room, 'host', { maxPlayers: 2 }, now)
    expect(room.members.map(m => m.id)).toEqual(['host', 'friend1'])
  })
  it('requires all configured players and locks settings after start', () => {
    const room = lobby(2)
    updateLobbySettings(room, 'host', { maxPlayers: 3 }, now)
    expect(() => start(room, 'host', now)).toThrow('All configured seats')
    join(room, person('friend2'), now)
    expect(() => start(room, 'host', now)).toThrow('All configured seats')
    room.members[2].connected = true
    expect(() => start(room, 'friend1', now)).toThrow('Only the host')
    start(room, 'host', now, () => .5)
    const before = structuredClone(room)
    expect(() => gameAction(room, 'host', { type: 'update-settings', settings: { maxPlayers: 8 } }, now)).toThrow('locked')
    expect(room).toEqual(before)
  })
  it('serializes both join/resize orderings without losing players', () => {
    const joinedFirst = lobby(2)
    join(joinedFirst, person('friend2'), now)
    expect(() => updateLobbySettings(joinedFirst, 'host', { maxPlayers: 2 }, now)).toThrow('occupied or reserved')
    expect(joinedFirst.members).toHaveLength(3)
    const resizedFirst = lobby(2)
    updateLobbySettings(resizedFirst, 'host', { maxPlayers: 2 }, now)
    expect(() => join(resizedFirst, person('friend2'), now)).toThrow('full')
    expect(resizedFirst.members).toHaveLength(2)
  })
  it('allows the replacement lobby host to configure without changing order', () => {
    const room = lobby(3)
    leave(room, 'host', now)
    expect(room.hostId).toBe('friend1')
    updateLobbySettings(room, 'friend1', { maxPlayers: 2, eliminationThreshold: 50 }, now)
    expect(room.members.map(m => m.id)).toEqual(['friend1', 'friend2'])
  })
})
