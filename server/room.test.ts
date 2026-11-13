import { describe, expect, it } from 'vitest'
import { createRoom, gameAction, join, leave, start, sweep, view, reconcileHost } from './room'
import {
  DEFAULT_ROOM_SETTINGS,
  LOBBY_GRACE_MS,
  HOST_TRANSFER_MS,
  HEARTBEAT_MS,
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


function pendingHost(count = 4) {
  const r = full(count, false)
  start(r, r.hostId, 0, () => .6)
  r.game!.phase = 'turn'; r.game!.sevens = null; r.game!.current = 0
  r.game!.indicator = createCard('spades', '9')
  r.game!.players.forEach((p, index) => { p.hand = [createCard('clubs', index === 0 ? '4' : index === 1 ? '2' : 'K')] })
  r.game!.players[0].score = 60
  gameAction(r, r.hostId, { type: 'show' }, 1)
  return r
}
describe('eliminated host handover', () => {
  it('requires a server-issued transfer, retains the spectator and updates every projection without changing the game', () => {
    const r = pendingHost(), old = r.hostId, target = r.members[2].id
    expect(r.hostTransfer).toMatchObject({ fromId: old, deadline: 1 + HOST_TRANSFER_MS })
    expect(() => gameAction(r, old, { type: 'next-round' }, 2)).toThrow(/host/)
    const before = structuredClone(r.game), order = r.members.map(m => m.id), transferId = r.hostTransfer!.id
    gameAction(r, old, { type: 'transfer-host', transferId, targetId: target }, 2)
    expect(r.hostId).toBe(target); expect(r.hostTransfer).toBeUndefined()
    expect(r.game).toEqual(before); expect(r.members.map(m => m.id)).toEqual(order)
    expect(r.game!.players[0].eliminated).toBe(true); expect(r.members[0].left).toBe(false)
    for (const m of r.members) expect(view(r, m.id, 2)).toMatchObject({ hostId: target, hostChange: { id: transferId, playerId: target, at: 2 } })
    const once = structuredClone(r.hostChange)
    expect(() => gameAction(r, old, { type: 'transfer-host', transferId, targetId: r.members[1].id }, 3)).toThrow(/host/)
    reconcileHost(r, 3); expect(r.hostChange).toEqual(once)
    expect(() => gameAction(r, old, { type: 'next-round' }, 3)).toThrow(/host/)
    gameAction(r, target, { type: 'next-round' }, 3)
    expect(r.game!.round).toBe(2)
  })
  it('rejects other actors, forged transfer IDs and unsolicited transfers', () => {
    const r = pendingHost(), transferId = r.hostTransfer!.id
    expect(() => gameAction(r, r.members[1].id, { type: 'transfer-host', transferId, targetId: r.members[2].id }, 2)).toThrow(/host/)
    expect(() => gameAction(r, r.hostId, { type: 'transfer-host', transferId: 'forged', targetId: r.members[2].id }, 2)).toThrow(/pending/)
    const live = full(3, false); start(live, live.hostId, 0, () => .6)
    expect(() => gameAction(live, live.hostId, { type: 'transfer-host', targetId: live.members[1].id }, 2)).toThrow(/pending/)
  })
  it.each(['eliminated', 'disconnected', 'left', 'expired', 'stale', 'self', 'unknown'])('rejects a %s target', kind => {
    const r = pendingHost(), target = r.members[2]
    if (kind === 'eliminated') r.game!.players[2].eliminated = true
    if (kind === 'disconnected') target.connected = false
    if (kind === 'left') target.left = true
    if (kind === 'expired') target.authExpiresAt = 1
    if (kind === 'stale') target.lastSeen = -HEARTBEAT_MS
    expect(() => gameAction(r, r.hostId, { type: 'transfer-host', transferId: r.hostTransfer!.id, targetId: kind === 'self' ? r.hostId : kind === 'unknown' ? 'unknown' : target.id }, 2)).toThrow(/connected, active/)
  })
  it('assigns the next eligible clockwise player after the selection deadline exactly once', () => {
    const r = pendingHost(), transfer = { ...r.hostTransfer! }, before = structuredClone(r.game)
    r.members[1].connected = false
    sweep(r, transfer.deadline)
    expect(r.hostId).toBe(r.members[2].id); expect(r.hostTransfer).toBeUndefined()
    expect(r.hostChange!.id).toBe(transfer.id); expect(r.game).toEqual(before)
    const change = structuredClone(r.hostChange)
    sweep(r, transfer.deadline + 1); expect(r.hostChange).toEqual(change)
  })
  it.each(['disconnect', 'leave', 'expiry'])('falls back when the eliminated host loses availability: %s', reason => {
    const r = pendingHost(), old = r.hostId
    if (reason === 'disconnect') r.members[0].connected = false
    if (reason === 'expiry') r.members[0].authExpiresAt = 2
    if (reason === 'leave') leave(r, old, 2)
    else sweep(r, 2)
    expect(r.hostId).toBe(r.members[1].id); expect(r.hostTransfer).toBeUndefined()
  })
  it('opens one prompt for simultaneous eliminations, or automatically selects the sole survivor', () => {
    for (const count of [3, 5]) {
      const r = full(count, false); start(r, r.hostId, 0, () => .6)
      r.game!.phase = 'turn'; r.game!.sevens = null; r.game!.current = 1; r.game!.indicator = createCard('spades', '9')
      r.game!.players.forEach((p, i) => { p.hand = [createCard('clubs', i === 1 ? 'A' : 'K')]; p.score = i === 0 || i === 2 ? 90 : 0 })
      gameAction(r, r.members[1].id, { type: 'show' }, 1)
      expect(r.game!.players.filter(p => p.eliminated)).toHaveLength(2)
      if (count === 3) { expect(r.hostId).toBe(r.members[1].id); expect(r.hostTransfer).toBeUndefined() }
      else { expect(r.hostTransfer!.fromId).toBe(r.members[0].id); expect(view(r, r.hostId, 1).hostTransfer!.eligibleIds).toEqual([r.members[1].id, r.members[3].id, r.members[4].id]) }
      const state = JSON.stringify([r.hostId, r.hostTransfer, r.hostChange])
      sweep(r, 2); sweep(r, 3)
      expect(JSON.stringify([r.hostId, r.hostTransfer, r.hostChange])).toBe(state)
    }
  })
  it('keeps gameplay and its normal deadline progression running during timeout-triggered selection', () => {
    const r = full(4); start(r, r.hostId, 0, () => .6)
    r.game!.phase = 'turn'; r.game!.sevens = null; r.game!.current = 0; r.game!.deadline = 1000
    r.game!.discards = [[{ ...createCard('clubs', '4'), id: 'previous-four' }]]
    r.game!.players[1].hand = [{ ...createCard('hearts', '4'), id: 'next-four' }, { ...createCard('clubs', '5'), id: 'next-five' }]
    sweep(r, 1000)
    expect(r.game!.players[0].eliminationReason).toBe('timeout')
    const pending = { ...r.hostTransfer! }
    expect(r.game!.current).toBe(1); expect(r.game!.deadline).toBe(61000)
    gameAction(r, r.members[1].id, { type: 'discard', cardIds: ['next-four'] }, 2000)
    expect(r.game!.current).toBe(2); expect(r.game!.deadline).toBe(62000)
    expect(r.hostTransfer).toEqual(pending)
  })
  it('does not appoint spectators/offline players, and recovers when an active player reconnects', () => {
    const r = pendingHost()
    r.members.slice(1).forEach(m => { m.connected = false })
    reconcileHost(r, 2)
    expect(r.hostId).toBe(''); expect(r.hostTransfer).toBeUndefined()
    r.members[2].connected = true; r.members[2].lastSeen = 3
    reconcileHost(r, 3); expect(r.hostId).toBe(r.members[2].id)
    r.game!.players.forEach(p => { p.eliminated = true })
    const game = structuredClone(r.game)
    reconcileHost(r, 4)
    expect(r.hostId).toBe(''); expect(r.hostTransfer).toBeUndefined(); expect(r.game).toEqual(game)
  })
})
