import type { PrivateProfile } from './identity'
import type { GameEvent } from '../game/events'
import type { Card } from '../game/cards'
import type { GameCard } from '../game/deck'
import type { Phase, RoundResult } from '../game/engine'

export type AccountType = 'guest' | 'registered'
export type PublicPlayer = {
  id: string
  displayName: string
  avatarUrl: string | null
  accountType: AccountType
}
export type SessionUser = {
  profile?: PrivateProfile
  player: PublicPlayer
  email: string | null
  createdAt: string
  lastActiveAt: string
}
export type RoomSettings = {
  maxPlayers: number
  eliminationThreshold: number
  timedGame: boolean
  turnDurationSeconds: 60 | null
}
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  eliminationThreshold: 100,
  timedGame: true,
  turnDurationSeconds: 60,
}
export const LOBBY_GRACE_MS = 90_000
export const HEARTBEAT_MS = 45_000
export function displayName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a display name.')
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 24 || !/^[\p{L}\p{N} ._-]+$/u.test(name))
    throw new Error(
      'Use 2–24 letters, numbers, spaces, dots, underscores, or hyphens.',
    )
  return name
}
export function roomCode(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a room code.')
  const code = value.trim().toUpperCase()
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code))
    throw new Error('Enter the six-character room code.')
  return code
}
export function roomSettings(value: unknown): RoomSettings {
  const v = value as Partial<RoomSettings> | null
  if (
    !v ||
    !Number.isInteger(v.maxPlayers) ||
    v.maxPlayers! < 2 ||
    v.maxPlayers! > 8
  )
    throw new Error('Choose 2–8 players.')
  if (
    !Number.isSafeInteger(v.eliminationThreshold) ||
    v.eliminationThreshold! <= 0
  )
    throw new Error('The elimination cutoff must be a positive whole number.')
  if (typeof v.timedGame !== 'boolean')
    throw new Error('Choose timed or untimed mode.')
  if (
    v.turnDurationSeconds !== undefined &&
    v.turnDurationSeconds !== (v.timedGame ? 60 : null)
  )
    throw new Error(
      'Timed turns are fixed at 60 seconds; untimed turns have no duration.',
    )
  return {
    maxPlayers: v.maxPlayers!,
    eliminationThreshold: v.eliminationThreshold!,
    timedGame: v.timedGame,
    turnDurationSeconds: v.timedGame ? 60 : null,
  }
}
export type Member = PublicPlayer & {
  order: number
  connected: boolean
  lastSeen: number
  disconnectedAt: number | null
  authExpiresAt: number
  left: boolean
}
export type PublicGamePlayer = PublicPlayer & {
  cardCount: number
  score: number
  eliminated: boolean
  eliminationReason?: 'score' | 'timeout'
}
export type GameView = {
  career?: { gameId: string; eligible: boolean; synced: boolean }
  phase: Phase
  round: number
  currentPlayerId: string
  players: PublicGamePlayer[]
  hand: GameCard[]
  indicator: Card
  latestDiscard: GameCard[]
  pickup: GameCard[]
  drawCount: number
  deadline: number | null
  penalty: number
  openingPenalty: boolean
  canShow: boolean
  result: RoundResult | null
  events: GameEvent[]
  log: string[]
}
export type RoomView = {
  id: string
  code: string
  hostId: string
  settings: RoomSettings
  status: 'waiting' | 'in-game' | 'closed'
  members: Member[]
  revision: number
  serverNow: number
  game: GameView | null
}
export type ClientGameAction = {
  type:
    'discard' | 'play-turn' | 'draw' | 'show' | 'accept-penalty' | 'next-round'
  cardIds?: string[]
  source?: 'pile' | 'discard'
  cardId?: string
}
export type SocketMessage =
  | { type: 'ack'; requestId: string }
  | { type: 'state'; room: RoomView }
  | { type: 'error'; message: string; requestId?: string }
  | { type: 'pong'; serverNow: number }
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export function avatarType(
  bytes: Uint8Array,
  mime: string,
): 'jpg' | 'png' | 'webp' {
  if (!bytes.length || bytes.length > AVATAR_MAX_BYTES)
    throw new Error('Choose an image no larger than 5 MB.')
  if (
    mime === 'image/jpeg' &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return 'jpg'
  if (
    mime === 'image/png' &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  )
    return 'png'
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end))
  if (
    mime === 'image/webp' &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 12) === 'WEBP'
  )
    return 'webp'
  throw new Error('Choose a valid JPG, PNG, or WebP image.')
}
