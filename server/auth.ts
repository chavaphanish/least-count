import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Env, Identity } from './types'
import type { SessionUser } from '../src/shared/multiplayer'
import {
  AVATAR_MAX_BYTES,
  avatarType,
  displayName,
} from '../src/shared/multiplayer'
import { ApiError, cookie, readBytes } from './http'
export const directory = (env: Env, path: string, data: unknown) =>
  env.DIRECTORY.get(env.DIRECTORY.idFromName('directory')).fetch(
    `https://directory${path}`,
    { method: 'POST', body: JSON.stringify(data) },
  )
export function publicConfig(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    return { supabase: null }
  const url = new URL(env.SUPABASE_URL)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co'))
    throw new ApiError(503, 'Supabase configuration is invalid.')
  if (env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_'))
    throw new ApiError(
      503,
      'Use a public Supabase publishable key, never a secret key.',
    )
  if (env.SUPABASE_PUBLISHABLE_KEY.split('.').length === 3) {
    try {
      const claims = JSON.parse(
        atob(
          env.SUPABASE_PUBLISHABLE_KEY.split('.')[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        ),
      )
      if (claims.role !== 'anon') throw new Error()
    } catch {
      throw new ApiError(
        503,
        'Use the public anon or publishable key, not a service-role key.',
      )
    }
  }
  return {
    supabase: { url: url.origin, publishableKey: env.SUPABASE_PUBLISHABLE_KEY },
  }
}
/** Public provider availability, queried only when Google sign-in is requested. */
export async function authProviders(env: Env): Promise<{ google: boolean }> {
  const config = publicConfig(env).supabase
  if (!config)
    throw new ApiError(503, 'Registered sign-in is not configured yet.')
  let response: Response
  try {
    response = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.publishableKey },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new ApiError(
      503,
      'Could not check Google sign-in availability. Please retry.',
    )
  }
  if (!response.ok)
    throw new ApiError(
      503,
      'Supabase authentication settings could not be loaded. Check the project URL and public key.',
    )
  const settings = (await response.json()) as {
    external?: { google?: boolean }
  }
  return { google: settings.external?.google === true }
}
function provider(env: Env, token: string) {
  const config = publicConfig(env).supabase
  if (!config)
    throw new ApiError(
      503,
      'Registered sign-in is not configured yet. You can continue as a guest.',
      'AUTH_NOT_CONFIGURED',
    )
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (url, options) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
    },
  })
}
export async function authenticate(
  request: Request,
  env: Env,
): Promise<{
  user: SessionUser
  identity: Identity
  client: SupabaseClient | null
  uid: string | null
} | null> {
  const authorization = request.headers.get('Authorization')
  if (authorization) {
    if (!authorization.startsWith('Bearer ') || authorization.length > 10_000)
      throw new ApiError(401, 'Sign in again.')
    const token = authorization.slice(7)
    const client = provider(env, token)
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user)
      throw new ApiError(
        401,
        'Your sign-in session expired. Sign in again.',
        'SESSION_EXPIRED',
      )
    const auth = data.user
    if (auth.is_anonymous || !auth.email_confirmed_at)
      throw new ApiError(
        403,
        'Verify your email before using this account.',
        'EMAIL_UNVERIFIED',
      )
    let proposed = 'Player'
    try {
      proposed = displayName(
        String(
          auth.user_metadata.display_name ??
            auth.user_metadata.full_name ??
            'Player',
        ).slice(0, 24),
      )
    } catch {
      /* Use a neutral default, never the private email. */
    }
    const profile = await client.rpc('ensure_player_profile', {
      proposed_display_name: proposed,
    })
    if (profile.error)
      throw new ApiError(
        503,
        'Profile setup is unavailable. Apply the Supabase migration and retry.',
        'PROFILE_UNAVAILABLE',
      )
    const row = Array.isArray(profile.data) ? profile.data[0] : profile.data
    if (!row || row.id !== auth.id)
      throw new ApiError(503, 'Your profile could not be loaded.')
    let expiresAt = 0
    try {
      const claims = JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      )
      expiresAt = Number(claims.exp) * 1000
    } catch {
      /* getUser already verified the token; require a valid expiry too. */
    }
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
      throw new ApiError(401, 'Your sign-in session expired.')
    const avatarUrl = row.avatar_path
      ? client.storage.from('avatars').getPublicUrl(row.avatar_path).data
          .publicUrl
      : null
    const user: SessionUser = {
      player: {
        id: `user:${auth.id}`,
        displayName: row.display_name,
        avatarUrl,
        accountType: 'registered',
      },
      email: auth.email ?? null,
      createdAt: auth.created_at,
      lastActiveAt: row.last_active_at,
    }
    return {
      user,
      identity: { ...user.player, expiresAt },
      client,
      uid: auth.id,
    }
  }
  const response = await directory(env, '/session', { token: cookie(request) })
  const guest = (await response.json()) as {
    user: SessionUser
    expiresAt: number
  } | null
  return guest
    ? {
        user: guest.user,
        identity: { ...guest.user.player, expiresAt: guest.expiresAt },
        client: null,
        uid: null,
      }
    : null
}
export async function requireAuth(request: Request, env: Env) {
  const auth = await authenticate(request, env)
  if (!auth) throw new ApiError(401, 'Sign in or continue as a guest first.')
  return auth
}
export async function updateProfile(
  request: Request,
  env: Env,
  input?: Record<string, unknown>,
) {
  const auth = await requireAuth(request, env)
  if (!auth.client || !auth.uid)
    throw new ApiError(
      403,
      'Profile settings are available to registered accounts.',
    )
  const client = auth.client
  const uid = auth.uid
  if (input) {
    if (input.userId !== undefined && input.userId !== uid)
      throw new ApiError(403, 'You can only update your own profile.')
    const name = displayName(input.displayName)
    const result = await client
      .from('profiles')
      .update({ display_name: name })
      .eq('id', uid)
    if (result.error)
      throw new ApiError(400, 'Your display name could not be saved.')
  } else {
    const old = await client
      .from('profiles')
      .select('avatar_path')
      .eq('id', uid)
      .single()
    if (old.error) throw new ApiError(503, 'Your profile could not be loaded.')
    let path: string | null = null
    if (request.method === 'POST') {
      const bytes = await readBytes(request, AVATAR_MAX_BYTES)
      let extension: string
      try {
        extension = avatarType(bytes, request.headers.get('Content-Type') ?? '')
      } catch (error) {
        throw new ApiError(
          400,
          error instanceof Error ? error.message : 'Invalid image.',
        )
      }
      path = `${uid}/${crypto.randomUUID()}.${extension}`
      const upload = await client.storage.from('avatars').upload(path, bytes, {
        contentType: request.headers.get('Content-Type')!,
        upsert: false,
      })
      if (upload.error)
        throw new ApiError(
          400,
          'The image could not be uploaded. Check the avatar storage policies.',
        )
    }
    if (request.method === 'DELETE' && old.data.avatar_path) {
      const removed = await client.storage
        .from('avatars')
        .remove([old.data.avatar_path])
      if (removed.error)
        throw new ApiError(503, 'The image could not be removed. Please retry.')
    }
    const saved = await client
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', uid)
    if (saved.error) {
      if (path) await client.storage.from('avatars').remove([path])
      throw new ApiError(503, 'The profile picture could not be saved.')
    }
    if (path && old.data.avatar_path)
      await client.storage.from('avatars').remove([old.data.avatar_path])
  }
  return (await requireAuth(request, env)).user
}
