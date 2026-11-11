import { describe, expect, it } from 'vitest'
import { createRoom, gameAction, join, leave, start, sweep, view } from './room'
import {
  DEFAULT_ROOM_SETTINGS,
  LOBBY_GRACE_MS,
  roomCode,
  roomSettings,
  avatarType,
  AVATAR_MAX_BYTES,
} from '../src/shared/multiplayer'
import type { Identity } from './types'
import { createCard } from '../src/game/cards'
const person = (
  id: string,
  accountType: 'guest' | 'registered' = 'guest',
): Identity => ({
  id: `${accountType === 'guest' ? 'guest' : 'user'}:${id}`,
  displayName: id,
  avatarUrl: null,
  accountType,
  expiresAt: 10 ** 12,
})
function full(count = 2, timed = true, cutoff = 100) {
  const host = person('Host')
  const r = createRoom(
    'room1',
    'ABC234',
    host,
    { maxPlayers: count, timedGame: timed, eliminationThreshold: cutoff },
    0,
  )
  for (let i = 1; i < count; i++)
    join(r, person(`Player${i}`, i % 2 ? 'registered' : 'guest'), 0)
  r.members.forEach((m) => {
    m.connected = true
    m.disconnectedAt = null
    m.lastSeen = 0
  })
  return r
}
describe('room configuration', () => {
  it('uses four players, 100 points, and 60-second turns by default', () => {
    expect(roomSettings(DEFAULT_ROOM_SETTINGS)).toEqual({
      maxPlayers: 4,
      eliminationThreshold: 100,
      timedGame: true,
      turnDurationSeconds: 60,
    })
  })
  it.each([2, 8])('accepts boundary capacity %i', (n) =>
    expect(
      roomSettings({ ...DEFAULT_ROOM_SETTINGS, maxPlayers: n }).maxPlayers,
    ).toBe(n),
  )
  it.each([1, 9, 2.5])('rejects invalid capacity %s', (n) =>
    expect(() =>
      roomSettings({ ...DEFAULT_ROOM_SETTINGS, maxPlayers: n }),
    ).toThrow(),
  )
  it.each([0, -2, 1.5, Infinity])(
    'rejects invalid elimination cutoff %s',
    (n) =>
      expect(() =>
        roomSettings({ ...DEFAULT_ROOM_SETTINGS, eliminationThreshold: n }),
      ).toThrow(),
  )
  it('normalizes codes and disables duration in untimed mode', () => {
    expect(roomCode(' abc234 ')).toBe('ABC234')
    expect(() => roomCode('000000')).toThrow()
    expect(
      roomSettings({
        maxPlayers: 2,
        eliminationThreshold: 250,
        timedGame: false,
      }),
    ).toEqual({
      maxPlayers: 2,
      eliminationThreshold: 250,
      timedGame: false,
      turnDurationSeconds: null,
    })
  })
  it('does not allow an additional timer duration', () =>
    expect(() =>
      roomSettings({ ...DEFAULT_ROOM_SETTINGS, turnDurationSeconds: 30 }),
    ).toThrow())
})
describe('authoritative membership and lobby', () => {
  it('creates a waiting room with one host seat, never an automatic game', () => {
    const r = createRoom(
      'id',
      'ABC234',
      person('Host'),
      DEFAULT_ROOM_SETTINGS,
      0,
    )
    expect(r.members).toHaveLength(1)
    expect(r.hostId).toBe('guest:Host')
    expect(r.game).toBeNull()
    expect(r.status).toBe('waiting')
  })
  it('does not duplicate identities, permits guest/registered mixing, and rejects a full room', () => {
    const r = full()
    join(r, person('Player1', 'registered'), 1)
    expect(r.members).toHaveLength(2)
    expect(r.members.map((m) => m.accountType)).toEqual(['guest', 'registered'])
    expect(() => join(r, person('Other'), 1)).toThrow(/full/)
  })
  it('requires the host and every distinct connected seat before starting', () => {
    const r = full(4)
    expect(() => start(r, r.members[1].id, 1)).toThrow(/host/)
    r.members[3].connected = false
    expect(() => start(r, r.hostId, 1)).toThrow(/connected/)
    r.members.pop()
    expect(() => start(r, r.hostId, 1)).toThrow(/configured seats/)
  })
  it('rejects a stale full lobby', () => {
    const r = full()
    expect(() => start(r, r.hostId, 45_000)).toThrow(/connected/)
  })
  it('starts once, uses real player IDs, rejects new players, and restores existing participants', () => {
    const r = full()
    start(r, r.hostId, 1, () => 0.6)
    const game = r.game
    expect(r.status).toBe('in-game')
    expect(r.game!.players.map((p) => p.id)).toEqual(r.members.map((m) => m.id))
    expect(() => start(r, r.hostId, 2)).toThrow(/already started/)
    expect(r.game).toBe(game)
    expect(() => join(r, person('Other'), 2)).toThrow(/already started/)
    join(r, person('Player1', 'registered'), 2)
    expect(r.members).toHaveLength(2)
  })
  it('transfers host to the earliest connected remaining participant and closes an empty room', () => {
    const r = full(3)
    leave(r, r.hostId, 1)
    expect(r.hostId).toBe('user:Player1')
    leave(r, r.hostId, 2)
    expect(r.hostId).toBe('guest:Player2')
    leave(r, r.hostId, 3)
    expect(r.status).toBe('closed')
  })
  it('retains disconnected lobby seats during grace and releases them afterward', () => {
    const r = full()
    r.members[0].connected = false
    r.members[0].disconnectedAt = 1
    sweep(r, LOBBY_GRACE_MS)
    expect(r.members.some((m) => m.id === 'guest:Host')).toBe(true)
    r.members[1].lastSeen = LOBBY_GRACE_MS
    r.members[1].connected = true
    sweep(r, LOBBY_GRACE_MS + 1)
    expect(r.hostId).toBe('user:Player1')
    expect(r.members).toHaveLength(1)
  })
})
describe('server game integration and privacy', () => {
  it.each([2, 4, 5, 8])(
    'deals the correct %i-player deck and seven cards each',
    (n) => {
      const r = full(n)
      start(r, r.hostId, 1, () => 0.6)
      const g = r.game!
      expect(
        g.players.every((p) => p.hand.length === 7 || p.hand.length === 9),
      ).toBe(true)
      expect(
        g.drawPile.length +
          g.players.flatMap((p) => p.hand).length +
          g.discards.flat().length +
          1,
      ).toBe(n <= 4 ? 53 : 106)
    },
  )
  it('never includes opponent hands or closed draw order in a member projection', () => {
    const r = full()
    start(r, r.hostId, 1, () => 0.6)
    const snapshot = view(r, r.members[0].id, 2)
    expect(snapshot.game!.hand).toEqual(r.game!.players[0].hand)
    expect(snapshot.game!.players.every((p) => !('hand' in p))).toBe(true)
    expect('drawPile' in snapshot.game!).toBe(false)
    expect(JSON.stringify(snapshot)).not.toContain('email')
    expect(() => view(r, 'outsider', 2)).toThrow(/Join/)
  })
  it('binds actions to the server identity, never a client-supplied player ID', () => {
    const r = full()
    start(r, r.hostId, 1, () => 0.6)
    const victim = r.game!.players[r.game!.current]
    const other = r.members.find((m) => m.id !== victim.id)!
    expect(() =>
      gameAction(
        r,
        other.id,
        { type: 'discard', playerId: victim.id, cardIds: [victim.hand[0].id] },
        2,
      ),
    ).toThrow(/Wait/)
    expect(() => gameAction(r, victim.id, { type: 'timeout' }, 2)).toThrow(
      /not available/,
    )
  })
  it('enforces custom cutoff and keeps untimed games free of timeout elimination', () => {
    const r = full(2, false, 5)
    start(r, r.hostId, 0, () => 0.6)
    r.game!.current = 0
    r.game!.players[0].hand = [createCard('clubs', 'A')]
    r.game!.players[1].hand = [createCard('clubs', 'K')]
    r.game!.indicator = createCard('spades', '9')
    sweep(r, 10000000)
    expect(r.game!.deadline).toBeNull()
    expect(r.game!.players.every((p) => !p.eliminated)).toBe(true)
    r.members[0].connected = true
    r.members[0].lastSeen = 10000000
    gameAction(r, r.hostId, { type: 'show' }, 10000000)
    expect(r.game!.players[1].eliminated).toBe(true)
    expect(r.game!.phase).toBe('game-over')
  })
  it('runs timeout elimination from server sweep without a client timeout action', () => {
    const r = full()
    start(r, r.hostId, 0, () => 0.6)
    const current = r.game!.current
    sweep(r, 60_000)
    expect(r.game!.players[current].eliminationReason).toBe('timeout')
    expect(r.game!.phase).toBe('game-over')
  })
})
describe('avatar input validation', () => {
  it('accepts signatures for JPG, PNG and WebP', () => {
    expect(avatarType(new Uint8Array([255, 216, 255, 0]), 'image/jpeg')).toBe(
      'jpg',
    )
    expect(
      avatarType(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        'image/png',
      ),
    ).toBe('png')
    expect(
      avatarType(new TextEncoder().encode('RIFF1234WEBP'), 'image/webp'),
    ).toBe('webp')
  })
  it('rejects mislabeled, executable, empty, and oversized files', () => {
    expect(() =>
      avatarType(new TextEncoder().encode('<svg/>'), 'image/png'),
    ).toThrow()
    expect(() =>
      avatarType(new Uint8Array([255, 216, 255]), 'text/html'),
    ).toThrow()
    expect(() => avatarType(new Uint8Array(), 'image/jpeg')).toThrow()
    expect(() =>
      avatarType(new Uint8Array(AVATAR_MAX_BYTES + 1), 'image/png'),
    ).toThrow()
  })
})

it('projects only public name fields and uses both names and handles in game events without changing game state', () => {
  const r = full()
  Object.assign(r.members[0], { accountType:'registered', username:'cardmaster99',firstName:'John',lastName:'Smith', email:'hidden@example.test',access_token:'secret' })
  const waiting = view(r,r.hostId,0)
  expect(waiting.members[0]).toMatchObject({username:'cardmaster99',firstName:'John',lastName:'Smith'})
  expect(JSON.stringify(waiting)).not.toMatch(/hidden@example|secret|access_token|"email"/)
  start(r,r.hostId,0,()=>0.5)
  const before = JSON.stringify(r.game)
  const snapshot = view(r,r.hostId,0)
  expect(snapshot.game!.players[0]).toMatchObject({firstName:'John',username:'cardmaster99'})
  expect(r.game!.players[0].name).toBe('John Smith (@cardmaster99)')
  expect(JSON.stringify(r.game)).toBe(before)
})

it('rejects forged 7 pickups after a full cycle and synchronizes the automatic replacement', () => {
  const r = full(2, false)
  start(r, r.hostId, 0, () => .5)
  const game = r.game!
  game.current = 0
  game.phase = 'turn'
  game.sevens = null
  game.discardedRank = null
  game.eligible = []
  game.discards = [[{...createCard('clubs','4'),id:'previous-four'}]]
  const host = r.members[0].id, other = r.members[1].id
  game.players.forEach((p,i)=>{p.hand=[{...createCard('clubs','7'),id:`seven-${i}`},{...createCard('clubs','5'),id:`five-${i}`},{...createCard('clubs','K'),id:`king-${i}`}]})
  gameAction(r,host,{type:'discard',cardIds:['seven-0']},1)
  gameAction(r,other,{type:'discard',cardIds:['seven-1']},2)
  expect(r.game!.sevens).toBeNull()
  expect(r.game!.current).toBe(0)
  for (const id of [host,other]) expect(view(r,id,2).game!.pickup).toEqual([])
  // Also protect a persisted old state whose cycle left the last 7 eligible.
  r.game!.eligible = ['seven-1']
  const before = structuredClone(r)
  expect(()=>gameAction(r,host,{type:'play-turn',cardIds:['five-0'],source:'discard',cardId:'seven-1'},3)).toThrow()
  expect(r).toEqual(before)
  gameAction(r,host,{type:'discard',cardIds:['five-0']},3)
  expect(r.game!.current).toBe(1)
  const own = view(r,host,3).game!, peer = view(r,other,3).game!
  expect(own.players).toEqual(peer.players)
  expect(own.drawCount).toBe(peer.drawCount)
  expect(own.pickup).toEqual([{...createCard('clubs','5'),id:'five-0'}])
  expect(peer.pickup).toEqual(own.pickup)
})
