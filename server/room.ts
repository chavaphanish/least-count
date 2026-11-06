import { beginCareer, observeCareer } from './career'
import type { CareerState } from './career'
import { gameEvents } from '../src/game/events'
import {
  applyAction,
  canShow,
  createGame,
  isPlaying,
  latestGroup,
  pickupCards,
  resolveForcedDraw,
} from '../src/game/engine'
import type { Action, GameState } from '../src/game/engine'
import {
  HEARTBEAT_MS,
  LOBBY_GRACE_MS,
  roomSettings,
} from '../src/shared/multiplayer'
import type {
  ClientGameAction,
  Member,
  PublicPlayer,
  RoomSettings,
  RoomView,
} from '../src/shared/multiplayer'
import type { Identity } from './types'
import { ApiError } from './http'
export type RoomRecord = {
  id: string
  code: string
  hostId: string
  settings: RoomSettings
  status: RoomView['status']
  members: Member[]
  revision: number
  createdAt: number
  game: GameState | null
  career?: CareerState
}
export const secureRandom = () =>
  crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
export const publicPlayer = (p: PublicPlayer): PublicPlayer => ({
  id: p.id,
  displayName: p.displayName,
  avatarUrl: p.avatarUrl,
  accountType: p.accountType,
})
export function createRoom(
  id: string,
  code: string,
  host: Identity,
  settings: unknown,
  now: number,
): RoomRecord {
  const r: RoomRecord = {
    id,
    code,
    hostId: host.id,
    settings: roomSettings(settings),
    status: 'waiting',
    members: [],
    revision: 0,
    createdAt: now,
    game: null,
  }
  join(r, host, now)
  return r
}
export function member(r: RoomRecord, id: string) {
  const m = r.members.find((m) => m.id === id)
  if (!m) throw new ApiError(403, 'Join this room before accessing it.')
  return m
}
export function join(r: RoomRecord, identity: Identity, now: number) {
  if (r.status === 'closed') throw new ApiError(410, 'This room is closed.')
  const existing = r.members.find((m) => m.id === identity.id)
  if (existing) {
    Object.assign(existing, publicPlayer(identity), {
      authExpiresAt: identity.expiresAt,
      left: false,
    })
    return
  }
  if (r.status !== 'waiting')
    throw new ApiError(
      409,
      'This game has already started. Only existing participants can reconnect.',
    )
  if (r.members.length >= r.settings.maxPlayers)
    throw new ApiError(
      409,
      'This room is full; a reconnecting seat may still be reserved.',
    )
  r.members.push({
    ...publicPlayer(identity),
    order: Math.max(0, ...r.members.map((m) => m.order)) + 1,
    connected: false,
    lastSeen: now,
    disconnectedAt: now,
    authExpiresAt: identity.expiresAt,
    left: false,
  })
}
export function transferHost(r: RoomRecord) {
  if (r.members.some((m) => m.id === r.hostId && !m.left)) return
  r.hostId =
    [...r.members]
      .filter((m) => !m.left)
      .sort(
        (a, b) =>
          Number(b.connected) - Number(a.connected) || a.order - b.order,
      )[0]?.id ?? ''
}
export function leave(r: RoomRecord, id: string, now: number) {
  const m = member(r, id)
  if (r.status === 'waiting') r.members = r.members.filter((p) => p.id !== id)
  else {
    m.connected = false
    m.disconnectedAt = now
    m.left = true
  }
  transferHost(r)
  if (!r.members.length) r.status = 'closed'
  if (r.game) observeCareer(r, r.game, r.game, now, false)
}
export function sweep(r: RoomRecord, now: number) {
  if (r.game) replaceGame(r, resolveForcedDraw(r.game, now, secureRandom), now)
  for (const m of r.members)
    if (
      m.connected &&
      (now - m.lastSeen >= HEARTBEAT_MS || m.authExpiresAt <= now)
    ) {
      m.connected = false
      m.disconnectedAt = now
    }
  if (r.status === 'waiting') {
    r.members = r.members.filter(
      (m) =>
        m.disconnectedAt === null || now - m.disconnectedAt < LOBBY_GRACE_MS,
    )
    if (!r.members.some((m) => m.id === r.hostId)) {
      r.hostId = ''
      transferHost(r)
    }
    if (!r.members.length) r.status = 'closed'
  }
  if (
    r.game &&
    isPlaying(r.game) &&
    r.game.deadline !== null &&
    r.game.deadline <= now
  )
    replaceGame(r, applyAction(r.game, { type: 'timeout' }, now, secureRandom), now)
}
export function start(
  r: RoomRecord,
  id: string,
  now: number,
  random = secureRandom,
  careerEnabled = false,
) {
  if (r.hostId !== id)
    throw new ApiError(403, 'Only the host can start the game.')
  if (r.status !== 'waiting' || r.game)
    throw new ApiError(
      409,
      'The game has already started or the room is closed.',
    )
  if (
    r.members.length !== r.settings.maxPlayers ||
    r.members.some(
      (m) =>
        !m.connected ||
        m.left ||
        m.authExpiresAt <= now ||
        now - m.lastSeen >= HEARTBEAT_MS,
    )
  )
    throw new ApiError(
      409,
      'All configured seats must be filled by connected players.',
    )
  r.game = createGame(
    r.members.map((m) => m.displayName),
    now,
    random,
    {
      eliminationThreshold: r.settings.eliminationThreshold,
      timedGame: r.settings.timedGame,
    },
    r.members.map((m) => m.id),
  )
  r.status = 'in-game'
  beginCareer(r, careerEnabled, now)
}
export function gameAction(
  r: RoomRecord,
  id: string,
  raw: unknown,
  now: number,
) {
  if (!r.game || r.status !== 'in-game')
    throw new ApiError(409, 'The game has not started.')
  const m = member(r, id)
  if (!m.connected || m.left || m.authExpiresAt <= now)
    throw new ApiError(403, 'Reconnect before making a move.')
  const a = raw as ClientGameAction
  if (!a || typeof a !== 'object')
    throw new ApiError(400, 'Choose a game action.')
  let action: Action
  if (a.type === 'next-round') {
    if (id !== r.hostId)
      throw new ApiError(403, 'Only the host can advance a completed round.')
    action = { type: 'next-round' }
  } else if (a.type === 'show' || a.type === 'accept-penalty')
    action = { type: a.type, playerId: id }
  else if (a.type === 'discard' || a.type === 'play-turn') {
    if (
      !Array.isArray(a.cardIds) ||
      !a.cardIds.length ||
      a.cardIds.length > 106 ||
      !a.cardIds.every((id) => typeof id === 'string' && id.length < 100)
    )
      throw new ApiError(400, 'Select cards from your hand.')
    if (a.type === 'play-turn') {
      if (a.source !== 'pile' && a.source !== 'discard')
        throw new ApiError(400, 'Choose a draw source.')
      action = {
        type: 'play-turn',
        playerId: id,
        cardIds: a.cardIds,
        source: a.source,
        cardId: a.cardId,
      }
    } else action = { type: 'discard', playerId: id, cardIds: a.cardIds }
  } else if (a.type === 'draw') {
    if (a.source !== 'pile' && a.source !== 'discard')
      throw new ApiError(400, 'Choose a draw source.')
    action = { type: a.type, playerId: id, source: a.source, cardId: a.cardId }
  } else throw new ApiError(400, 'That action is not available to a player.')
  try {
    replaceGame(r, applyAction(r.game, action, now, secureRandom), now, true)
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? error.message : 'Invalid move.',
    )
  }
}
/** Construct an allowlist projection. Never serialize the authoritative state. */
export function view(r: RoomRecord, id: string, now: number): RoomView {
  member(r, id)
  const g = r.game
  return {
    id: r.id,
    code: r.code,
    hostId: r.hostId,
    settings: r.settings,
    status: r.status,
    revision: r.revision,
    serverNow: now,
    members: r.members.map((m) => ({
      ...publicPlayer(m),
      order: m.order,
      connected: m.connected,
      lastSeen: m.lastSeen,
      disconnectedAt: m.disconnectedAt,
      authExpiresAt: m.authExpiresAt,
      left: m.left,
    })),
    game: g
      ? {
          career: r.career ? { gameId: r.id, eligible: r.career.eligible, synced: r.career.syncedRevision === r.career.revision } : undefined,
          phase: g.phase,
          round: g.round,
          currentPlayerId: g.players[g.current].id,
          players: g.players.map((p) => ({
            ...publicPlayer(member(r, p.id)),
            cardCount: p.hand.length,
            score: p.score,
            eliminated: p.eliminated,
            eliminationReason: p.eliminationReason,
          })),
          hand: g.players.find((p) => p.id === id)?.hand ?? [],
          indicator: g.indicator,
          latestDiscard: latestGroup(g),
          pickup: pickupCards(g),
          drawCount: g.drawPile.length,
          deadline: g.deadline,
          penalty: g.sevens?.amount ?? 0,
          openingPenalty: g.sevens?.opening === true,
          canShow: canShow(g, id),
          result: g.result,
          log: g.log,
          events: gameEvents(g),
        }
      : null,
  }
}

function replaceGame(r: RoomRecord, next: GameState, now: number, manual = false) {
  observeCareer(r, r.game, next, now, manual)
  r.game = next
}
