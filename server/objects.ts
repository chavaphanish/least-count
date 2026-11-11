import { syncCareer } from './career'
import { normalizeLegacyTurn } from '../src/game/engine'
import type { Env, Identity } from './types'
import { ApiError, body, failure, hash, json, randomToken } from './http'
import {
  createRoom,
  gameAction,
  join,
  leave,
  member,
  start,
  sweep,
  view,
} from './room'
import type { RoomRecord } from './room'
import {
  HEARTBEAT_MS,
  LOBBY_GRACE_MS,
  displayName,
} from '../src/shared/multiplayer'
import type { SessionUser } from '../src/shared/multiplayer'

type Guest = { user: SessionUser; expiresAt: number }
type Reservation = { id: string; code: string }
export class Directory {
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}
  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const data = await body(request)
        const path = new URL(request.url).pathname
        if (path === '/access-limit') {
          const now=Date.now(),limit=data.limit===40?40:12
          let bucket=await this.ctx.storage.get<{count:number;expires:number}>('access-rate')
          if(!bucket||bucket.expires<=now)bucket={count:0,expires:now+300000}
          bucket.count++
          await this.ctx.storage.put('access-rate',bucket)
          await this.ctx.storage.setAlarm(bucket.expires)
          if(bucket.count>limit)throw new ApiError(429,'Too many attempts.')
          return json({ok:true})
        }
        if (path === '/guest') {
          const name = displayName(data.displayName)
          const token = randomToken()
          const id = `guest:${crypto.randomUUID()}`
          const now = new Date().toISOString()
          const guest: Guest = {
            user: {
              player: {
                id,
                displayName: name,
                avatarUrl: null,
                accountType: 'guest',
              },
              email: null,
              createdAt: now,
              lastActiveAt: now,
            },
            expiresAt: Date.now() + 604800000,
          }
          await this.ctx.storage.put(`session:${await hash(token)}`, guest)
          return json({ ...guest, token })
        }
        if (path === '/session' || path === '/logout') {
          const token = typeof data.token === 'string' ? data.token : ''
          if (!/^[a-f0-9]{64}$/.test(token)) return json(null)
          const key = `session:${await hash(token)}`
          const guest = await this.ctx.storage.get<Guest>(key)
          if (!guest || guest.expiresAt <= Date.now()) {
            await this.ctx.storage.delete(key)
            return json(null)
          }
          if (path === '/logout') await this.ctx.storage.delete(key)
          else {
            guest.user.lastActiveAt = new Date().toISOString()
            await this.ctx.storage.put(key, guest)
          }
          return json(guest)
        }
        if (path === '/lookup')
          return json(
            (await this.ctx.storage.get<Reservation>(`room:${data.code}`)) ??
              null,
          )
        if (path === '/membership')
          return json(
            (await this.ctx.storage.get<Reservation>(`member:${data.id}`)) ??
              null,
          )
        if (path === '/track') {
          const old = await this.ctx.storage.get<Reservation>(
            `member:${data.id}`,
          )
          if (old && old.id !== data.roomId)
            throw new ApiError(
              409,
              'Leave your current room before joining another.',
            )
          await this.ctx.storage.put(`member:${data.id}`, {
            id: data.roomId,
            code: data.code,
          })
          return json({ ok: true })
        }
        if (path === '/untrack') {
          const old = await this.ctx.storage.get<Reservation>(
            `member:${data.id}`,
          )
          if (old?.id === data.roomId)
            await this.ctx.storage.delete(`member:${data.id}`)
          return json({ ok: true })
        }
        if (path === '/create') {
          const identity = data.identity as Identity
          if (await this.ctx.storage.get(`member:${identity.id}`))
            throw new ApiError(
              409,
              'Leave your current room before creating another.',
            )
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
          let code = ''
          for (let attempt = 0; attempt < 20; attempt++) {
            const bytes = crypto.getRandomValues(new Uint8Array(6))
            code = Array.from(
              bytes,
              (byte) => alphabet[byte % alphabet.length],
            ).join('')
            if (!(await this.ctx.storage.get(`room:${code}`))) break
            code = ''
          }
          if (!code)
            throw new ApiError(503, 'Room codes are busy. Please retry.')
          const reservation = { id: crypto.randomUUID(), code }
          await this.ctx.storage.put(`room:${code}`, reservation)
          try {
            const response = await this.env.ROOMS.get(
              this.env.ROOMS.idFromName(reservation.id),
            ).fetch('https://room/initialize', {
              method: 'POST',
              body: JSON.stringify({
                ...reservation,
                identity,
                settings: data.settings,
              }),
            })
            if (!response.ok) {
              await this.ctx.storage.delete(`room:${code}`)
              return response
            }
            await this.ctx.storage.put(`member:${identity.id}`, reservation)
            return json(reservation, 201)
          } catch (error) {
            await this.ctx.storage.delete(`room:${code}`)
            throw error
          }
        }
        if (path === '/release') {
          const reservation = await this.ctx.storage.get<Reservation>(
            `room:${data.code}`,
          )
          if (reservation?.id === data.roomId)
            await this.ctx.storage.delete(`room:${data.code}`)
          return json({ ok: true })
        }
        throw new ApiError(404, 'Unknown directory operation.')
      } catch (error) {
        return failure(
          error instanceof ApiError
            ? error
            : new ApiError(
                400,
                error instanceof Error ? error.message : 'Invalid request.',
              ),
        )
      }
    })
  }
  async alarm(){await this.ctx.blockConcurrencyWhile(async()=>{const bucket=await this.ctx.storage.get<{expires:number}>('access-rate');if(!bucket||bucket.expires<=Date.now())await this.ctx.storage.delete('access-rate');else await this.ctx.storage.setAlarm(bucket.expires)})}
}

type Ticket = { identity: Identity; expiresAt: number }
type Connection = { playerId: string; expiresAt: number }
export class GameRoom {
  private record: RoomRecord | null = null
  private seen: string[] = []
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<RoomRecord>('room')) ?? null
      if (this.record?.game)
        this.record.game = normalizeLegacyTurn(this.record.game)
      this.seen = (await ctx.storage.get<string[]>('seen')) ?? []
    })
  }
  private directory(path: string, data: unknown) {
    return this.env.DIRECTORY.get(
      this.env.DIRECTORY.idFromName('directory'),
    ).fetch(`https://directory${path}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  private careerSyncing = false
  private async flushCareer() {
    const career = this.record?.career
    if (!career?.eligible || this.careerSyncing || career.revision === career.syncedRevision) return
    this.careerSyncing = true
    try {
      if (await syncCareer(career, this.env)) await this.ctx.storage.put('room', this.record)
    } catch { /* Durable snapshot remains pending for the next alarm. */ }
    finally { this.careerSyncing = false }
  }
  private async persist(broadcast = true) {
    const r = this.record!
    if (broadcast) r.revision++
    await this.ctx.storage.put({ room: r, seen: this.seen })
    const now = Date.now()
    const deadlines: number[] = []
    const pendingCareer = r.career?.eligible && r.career.revision !== r.career.syncedRevision
    if (pendingCareer) deadlines.push(now + 60_000)
    if (r.game?.deadline !== null && r.game?.deadline !== undefined)
      deadlines.push(r.game.deadline)
    for (const m of r.members) {
      if (m.connected)
        deadlines.push(m.lastSeen + HEARTBEAT_MS, m.authExpiresAt)
      else if (r.status === 'waiting' && m.disconnectedAt !== null)
        deadlines.push(m.disconnectedAt + LOBBY_GRACE_MS)
    }
    if (r.status === 'closed') {
      await this.ctx.storage.deleteAlarm()
      for (const ws of this.ctx.getWebSockets()) ws.close(4001, 'Room closed')
      await this.directory('/release', { code: r.code, roomId: r.id })
      for (const m of r.members)
        await this.directory('/untrack', { id: m.id, roomId: r.id })
    } else if (deadlines.length)
      await this.ctx.storage.setAlarm(
        Math.max(now + 50, Math.min(...deadlines)),
      )
    else await this.ctx.storage.deleteAlarm()
    if (pendingCareer && r.status === 'closed') await this.ctx.storage.setAlarm(now + 60_000)
    if (pendingCareer) this.ctx.waitUntil(this.flushCareer())
    if (broadcast)
      for (const ws of this.ctx.getWebSockets()) {
        try {
          const auth = ws.deserializeAttachment() as Connection
          if (
            auth.expiresAt <= now ||
            !r.members.some((m) => m.id === auth.playerId && !m.left)
          ) {
            ws.close(4003, 'Session expired or seat left')
            continue
          }
          ws.send(
            JSON.stringify({
              type: 'state',
              room: view(r, auth.playerId, now),
            }),
          )
        } catch {
          ws.close(1011, 'Connection lost')
        }
      }
  }
  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const url = new URL(request.url)
        if (url.pathname === '/ws') {
          const token = url.searchParams.get('ticket') ?? ''
          if (!/^[a-f0-9]{64}$/.test(token))
            throw new ApiError(401, 'Request a new connection ticket.')
          const key = `ticket:${await hash(token)}`
          const ticket = await this.ctx.storage.get<Ticket>(key)
          await this.ctx.storage.delete(key)
          if (
            !ticket ||
            ticket.expiresAt <= Date.now() ||
            ticket.identity.expiresAt <= Date.now()
          )
            throw new ApiError(401, 'Connection ticket expired.')
          if (!this.record || this.record.status === 'closed')
            throw new ApiError(410, 'Room closed.')
          const m = member(this.record, ticket.identity.id)
          if (m.left)
            throw new ApiError(403, 'Rejoin the room before connecting.')
          const pair = new WebSocketPair()
          const [client, server] = Object.values(pair)
          this.ctx.acceptWebSocket(server, [m.id])
          server.serializeAttachment({
            playerId: m.id,
            expiresAt: ticket.identity.expiresAt,
          } satisfies Connection)
          Object.assign(m, {
            connected: true,
            disconnectedAt: null,
            lastSeen: Date.now(),
            authExpiresAt: ticket.identity.expiresAt,
          })
          await this.persist()
          return new Response(null, { status: 101, webSocket: client })
        }
        const data = await body(request)
        const identity = data.identity as Identity
        if (url.pathname === '/initialize') {
          if (this.record) throw new ApiError(409, 'Room already exists.')
          this.record = createRoom(
            String(data.id),
            String(data.code),
            identity,
            data.settings,
            Date.now(),
          )
          await this.persist()
          return json({ ok: true })
        }
        const r = this.record
        if (!r) throw new ApiError(404, 'Room not found.')
        const beforeSweep = r.members.map((m) => m.id)
        sweep(r, Date.now())
        for (const id of beforeSweep)
          if (!r.members.some((m) => m.id === id))
            await this.directory('/untrack', { id, roomId: r.id })
        if (r.status === 'closed') {
          await this.persist()
          throw new ApiError(410, 'This room is closed.')
        }
        if (url.pathname === '/join') join(r, identity, Date.now())
        else {
          const currentMember = member(r, identity.id)
          // Refresh public identity on authenticated view/ticket requests after profile edits.
          currentMember.displayName = identity.displayName
          currentMember.avatarUrl = identity.avatarUrl
          if (url.pathname === '/ticket') {
            const tickets = await this.ctx.storage.list<Ticket>({
              prefix: 'ticket:',
            })
            for (const [key, value] of tickets)
              if (value.expiresAt <= Date.now())
                await this.ctx.storage.delete(key)
            if (
              [...tickets.values()].filter((t) => t.expiresAt > Date.now())
                .length >= 100
            )
              throw new ApiError(
                429,
                'Too many pending connections. Please retry shortly.',
              )
            const token = randomToken()
            await this.ctx.storage.put(`ticket:${await hash(token)}`, {
              identity,
              expiresAt: Math.min(Date.now() + 60_000, identity.expiresAt),
            } satisfies Ticket)
            await this.persist()
            return json({ ticket: token })
          }
          if (url.pathname === '/start') {
            for (const m of r.members)
              if (
                m.connected &&
                !this.ctx
                  .getWebSockets(m.id)
                  .some(
                    (ws) =>
                      ws.readyState === 1 &&
                      (ws.deserializeAttachment() as Connection).expiresAt >
                        Date.now(),
                  )
              ) {
                m.connected = false
                m.disconnectedAt = Date.now()
              }
            start(r, identity.id, Date.now(), undefined, data.careerAllowed === true && this.env.CAREER_ENABLED === 'true' && !!this.env.SUPABASE_CAREER_KEY)
          } else if (url.pathname === '/leave') {
            leave(r, identity.id, Date.now())
            for (const ws of this.ctx.getWebSockets(identity.id))
              ws.close(4001, 'You left the room')
            const tickets = await this.ctx.storage.list<Ticket>({
              prefix: 'ticket:',
            })
            for (const [key, value] of tickets)
              if (value.identity.id === identity.id)
                await this.ctx.storage.delete(key)
            await this.directory('/untrack', { id: identity.id, roomId: r.id })
          } else if (url.pathname === '/close') {
            if (r.hostId !== identity.id)
              throw new ApiError(403, 'Only the host can close the room.')
            if (r.status !== 'waiting')
              throw new ApiError(
                409,
                'An active game cannot be closed from the lobby.',
              )
            r.status = 'closed'
          } else if (url.pathname !== '/view')
            throw new ApiError(404, 'Unknown room operation.')
        }
        await this.persist()
        return json(
          url.pathname === '/leave' || url.pathname === '/close'
            ? { ok: true }
            : view(r, identity.id, Date.now()),
        )
      } catch (error) {
        if (this.record) await this.persist()
        return failure(error)
      }
    })
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      let requestId: string | undefined
      try {
        if (typeof message !== 'string' || message.length > 16_384)
          throw new ApiError(400, 'Invalid message.')
        const data = JSON.parse(message) as {
          type?: string
          requestId?: string
          action?: unknown
        }
        const auth = ws.deserializeAttachment() as Connection
        const r = this.record!
        if (auth.expiresAt <= Date.now()) {
          ws.close(4003, 'Session expired')
          return
        }
        const m = member(r, auth.playerId)
        if (m.left) throw new ApiError(403, 'Rejoin before playing.')
        m.lastSeen = Date.now()
        m.connected = true
        m.disconnectedAt = null
        const beforeSweep = r.members.map((m) => m.id)
        sweep(r, Date.now())
        for (const id of beforeSweep)
          if (!r.members.some((m) => m.id === id))
            await this.directory('/untrack', { id, roomId: r.id })
        if (data.type === 'ping') {
          await this.persist(false)
          ws.send(JSON.stringify({ type: 'pong', serverNow: Date.now() }))
          return
        }
        requestId = data.requestId
        if (
          data.type !== 'action' ||
          typeof requestId !== 'string' ||
          requestId.length > 100
        )
          throw new ApiError(400, 'Choose a game action.')
        const key = `${auth.playerId}:${requestId}`
        if (!this.seen.includes(key)) {
          gameAction(r, auth.playerId, data.action, Date.now())
          this.seen = [...this.seen.slice(-99), key]
        }
        await this.persist()
        ws.send(JSON.stringify({ type: 'ack', requestId }))
      } catch (error) {
        if (this.record) await this.persist()
        const message =
          error instanceof ApiError
            ? error.message
            : 'That action could not be completed.'
        ws.send(JSON.stringify({ type: 'error', message, requestId }))
      }
    })
  }
  async webSocketClose(ws: WebSocket) {
    await this.ctx.blockConcurrencyWhile(async () => {
      if (!this.record) return
      const auth = ws.deserializeAttachment() as Connection
      const m = this.record.members.find((m) => m.id === auth?.playerId)
      if (
        m &&
        !this.ctx
          .getWebSockets(m.id)
          .some((other) => other !== ws && other.readyState === 1)
      ) {
        m.connected = false
        m.disconnectedAt = Date.now()
      }
      await this.persist()
    })
  }
  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws)
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      if (!this.record) return
      const before = this.record.members.map((m) => m.id)
      sweep(this.record, Date.now())
      for (const id of before)
        if (!this.record.members.some((m) => m.id === id))
          await this.directory('/untrack', { id, roomId: this.record.id })
      for (const ws of this.ctx.getWebSockets()) {
        const auth = ws.deserializeAttachment() as Connection
        const m = this.record.members.find((m) => m.id === auth.playerId)
        if (!m || !m.connected || auth.expiresAt <= Date.now())
          ws.close(4003, 'Reconnect to restore your seat')
      }
      await this.persist()
    })
  }
}
