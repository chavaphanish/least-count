import { xpProgress } from '../src/career/model'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, publicConfig } from './auth'
import { ApiError, body, json } from './http'
import type { Env } from './types'

export async function careerApi(request: Request, env: Env) {
  const auth = await requireAuth(request, env)
  if (
    env.CAREER_ENABLED !== 'true' ||
    !env.SUPABASE_CAREER_KEY ||
    !env.CAREER_ORIGIN
  )
    throw new ApiError(
      503,
      'Player careers are not enabled yet. You can still play casual games and edit your photo.',
    )
  const url = new URL(request.url)
  const operation =
    request.method === 'POST'
      ? 'relationship'
      : (url.searchParams.get('op') ?? 'profile')
  if (
    ![
      'profile',
      'public',
      'leaderboard',
      'search',
      'buddies',
      'game',
      'reward',
      'relationship',
    ].includes(operation)
  )
    throw new ApiError(400, 'Unknown career request.')
  if (request.method === 'GET' && operation === 'relationship')
    throw new ApiError(
      405,
      'Use the buddy action button to change relationships.',
    )
  if (request.method === 'POST' && !auth.uid)
    throw new ApiError(403, 'Create a verified account to add buddies.')
  if (!auth.uid && !['public', 'leaderboard', 'search'].includes(operation))
    throw new ApiError(
      403,
      'Create a verified account to save your career and add buddies.',
    )
  const config = publicConfig(env).supabase
  if (!config) throw new ApiError(503, 'Player careers are not configured yet.')
  const client =
    auth.client ??
    createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, options) =>
          fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
      },
    })
  const args =
    request.method === 'POST'
      ? await body(request)
      : Object.fromEntries(url.searchParams)
  if (typeof args.username === 'string')
    args.username = args.username.replace(/^@/, '').toLowerCase()
  if (typeof args.query === 'string') args.query = args.query.replace(/^@/, '')
  const result = await client.rpc('career_api', { operation, args })
  if (result.error)
    throw new ApiError(
      result.error.code === 'PGRST202' ? 503 : 400,
      result.error.code === 'PGRST202'
        ? 'Player careers need the latest database migration. Please retry after setup.'
        : 'This player or action is unavailable. Refresh and retry.',
    )
  // Only storage paths from the public projection become image URLs. Never return secrets.
  function images(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(images)
    if (!value || typeof value !== 'object') return value
    const object = value as Record<string, unknown>
    const next = Object.fromEntries(
      Object.entries(object)
        .filter(([key]) => key !== 'avatarPath')
        .map(([key, v]) => [key, images(v)]),
    )
    if (typeof object.username === 'string')
      next.displayName = `@${object.username}`
    if (typeof object.xp === 'number')
      next.progress = xpProgress(
        object.xp,
        typeof object.levelBase === 'number' ? object.levelBase : undefined,
      )
    if ('avatarPath' in object)
      next.avatarUrl =
        typeof object.avatarPath === 'string' &&
        object.avatarPath.startsWith(`${object.id}/`)
          ? client.storage.from('avatars').getPublicUrl(object.avatarPath).data
              .publicUrl
          : null
    return next
  }
  return json(images(result.data))
}
