import type { Env } from './types'
import {
  authenticate,
  authProviders,
  directory,
  publicConfig,
  requireAuth,
  updateProfile,
} from './auth'
import {
  ApiError,
  body,
  cookie,
  failure,
  guestCookie,
  json,
  requireOrigin,
} from './http'
import { roomCode, roomSettings } from '../src/shared/multiplayer'
export { Directory, GameRoom } from './objects'
type Reservation = { id: string; code: string }
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      if (request.method !== 'GET' || url.pathname.endsWith('/ws'))
        requireOrigin(request, env.APP_ORIGIN)
      if (url.pathname === '/api/config' && request.method === 'GET')
        return json({
          ...publicConfig(env),
          service: 'least-count',
          lobbyGraceSeconds: 90,
        })
      if (url.pathname === '/api/auth/providers' && request.method === 'GET')
        return json(await authProviders(env))
      if (url.pathname === '/api/session' && request.method === 'GET') {
        const auth = await authenticate(request, env)
        const membership = auth
          ? await (
              await directory(env, '/membership', { id: auth.identity.id })
            ).json()
          : null
        return json({ user: auth?.user ?? null, room: membership })
      }
      if (url.pathname === '/api/guest' && request.method === 'POST') {
        const input = await body(request)
        const response = await directory(env, '/guest', {
          displayName: input.displayName,
        })
        if (!response.ok) return response
        const guest = (await response.json()) as {
          token: string
          user: unknown
        }
        return new Response(JSON.stringify({ user: guest.user }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Set-Cookie': guestCookie(request, guest.token),
          },
        })
      }
      if (url.pathname === '/api/logout' && request.method === 'POST') {
        const auth = await authenticate(request, env)
        if (auth) {
          const reservation = (await (
            await directory(env, '/membership', { id: auth.identity.id })
          ).json()) as Reservation | null
          if (reservation)
            await env.ROOMS.get(env.ROOMS.idFromName(reservation.id)).fetch(
              'https://room/leave',
              {
                method: 'POST',
                body: JSON.stringify({ identity: auth.identity }),
              },
            )
        }
        await directory(env, '/logout', { token: cookie(request) })
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Set-Cookie': guestCookie(request, '', 0),
          },
        })
      }
      if (url.pathname === '/api/profile' && request.method === 'PATCH')
        return json({
          user: await updateProfile(request, env, await body(request)),
        })
      if (
        url.pathname === '/api/profile/avatar' &&
        ['POST', 'DELETE'].includes(request.method)
      )
        return json({ user: await updateProfile(request, env) })
      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        const auth = await requireAuth(request, env)
        const settings = roomSettings(await body(request))
        return directory(env, '/create', { identity: auth.identity, settings })
      }
      const match =
        /^\/api\/rooms\/([A-Za-z0-9]{6})(?:\/(join|ticket|start|leave|close|ws))?$/.exec(
          url.pathname,
        )
      if (!match) throw new ApiError(404, 'Endpoint not found.')
      const code = roomCode(match[1])
      const operation = match[2] ?? 'view'
      const reservation = (await (
        await directory(env, '/lookup', { code })
      ).json()) as Reservation | null
      if (!reservation)
        throw new ApiError(
          404,
          'That room code is invalid or the room has closed.',
        )
      const stub = env.ROOMS.get(env.ROOMS.idFromName(reservation.id))
      if (operation === 'ws') {
        if (
          request.method !== 'GET' ||
          request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
        )
          throw new ApiError(400, 'A WebSocket upgrade is required.')
        return stub.fetch(
          `https://room/ws?ticket=${encodeURIComponent(url.searchParams.get('ticket') ?? '')}`,
          request,
        )
      }
      if (
        (operation === 'view' && request.method !== 'GET') ||
        (operation !== 'view' && request.method !== 'POST')
      )
        throw new ApiError(405, 'This method is not supported.')
      const auth = await requireAuth(request, env)
      if (operation === 'join') {
        const tracked = await directory(env, '/track', {
          id: auth.identity.id,
          roomId: reservation.id,
          code,
        })
        if (!tracked.ok) return tracked
      }
      const response = await stub.fetch(`https://room/${operation}`, {
        method: 'POST',
        body: JSON.stringify({ identity: auth.identity }),
      })
      if (operation === 'join' && !response.ok)
        await directory(env, '/untrack', {
          id: auth.identity.id,
          roomId: reservation.id,
        })
      return response
    } catch (error) {
      if (error instanceof ApiError) return failure(error)
      if (
        error instanceof Error &&
        ['TypeError', 'AbortError', 'TimeoutError'].includes(error.name)
      )
        return failure(
          new ApiError(503, 'The service is unavailable. Please retry.'),
        )
      return failure(
        new ApiError(
          400,
          error instanceof Error ? error.message : 'Invalid request.',
        ),
      )
    }
  },
} satisfies ExportedHandler<Env>
