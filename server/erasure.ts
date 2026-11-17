import type { RoomRecord } from './room'
import { leave, reconcileHost } from './room'
import { gameEvents, formatGameEvent } from '../src/game/events'
import { hash } from './http'

export function erasureBlocked(room: RoomRecord, uid: string) {
  const player = room.game?.players.find(p => p.id === `user:${uid}`)
  return !!(player && !player.eliminated && room.game?.phase !== 'game-over' && room.status !== 'closed' && room.members.some(m => !m.left))
}
/** Privacy-only identity replacement; never changes scores, hands, order, or deadlines. */
export async function eraseRoomIdentity(room: RoomRecord, uid: string, now = Date.now()) {
  const old = `user:${uid}`, alias = `deleted:${(await hash(`${room.id}:${uid}`)).slice(0,32)}`
  const seat = room.members.find(m => m.id === old)
  if (seat && !seat.left) leave(room, old, now)
  function scrub(value: unknown): unknown {
    if (typeof value === 'string') return value.replaceAll(old,alias).replaceAll(uid,alias)
    if (Array.isArray(value)) return value.map(scrub)
    if (!value || typeof value !== 'object') return value
    const obj = value as Record<string,unknown>, next = Object.fromEntries(Object.entries(obj).map(([key,v])=>[key,scrub(v)]))
    if (obj.id === old || obj.id === uid) {
      next.id=alias
      for(const key of ['username','firstName','lastName','first_name','last_name','avatarPath','avatar_path']) delete next[key]
      if('name' in obj)next.name='Deleted player'
      if('displayName' in obj)next.displayName='Deleted player'
      if('avatarUrl' in obj)next.avatarUrl=null
      if('accountType' in obj)next.accountType='guest'
      if('stats' in obj)next.stats={}
    }
    return next
  }
  const clean = scrub(room) as RoomRecord
  Object.assign(room,clean)
  if(room.game) {
    // Legacy free-text logs cannot safely attribute a name to one specific seat.
    room.game.events=gameEvents(room.game).map(event=>event.type==='LEGACY_ACTIVITY'?{...event,message:'Historical activity (identity removed).'}:event)
    room.game.log=room.game.events.map(formatGameEvent)
  }
  if(room.members.every(m=>m.left))room.status='closed'
  reconcileHost(room,now)
  return alias
}
