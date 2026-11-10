import { createClient } from '@supabase/supabase-js'
import { authenticate, publicConfig, requireAuth } from './auth'
import { username, personalName } from '../src/shared/identity'
import { ApiError } from './http'
import type { Env } from './types'
export async function checkUsername(request: Request, env: Env) {
  let candidate: string
  try {
    candidate = username(new URL(request.url).searchParams.get('username'))
  } catch (error) {
    throw new ApiError(400, (error as Error).message)
  }
  const config = publicConfig(env).supabase
  if (!config) throw new ApiError(503, 'Registration is not configured yet.')
  const auth = request.headers.has('Authorization')
    ? await authenticate(request, env)
    : null
  const client =
    auth?.client ??
    createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (url, options) =>
          fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
      },
    })
  const result = await client.rpc('player_username_available', { candidate })
  if (result.error || typeof result.data !== 'boolean')
    throw new ApiError(
      503,
      'Username checks need the identity database migration. You can still sign in to an existing account.',
      'IDENTITY_UNAVAILABLE',
    )
  return { username: candidate, available: result.data }
}
export async function saveIdentity(
  request: Request,
  env: Env,
  input: Record<string, unknown>,
) {
  const auth = await requireAuth(request, env)
  if (!auth.client) throw new ApiError(403, 'A verified account is required.')
  let handle: string, firstName: string, lastName: string
  try {
    handle = username(input.username)
    firstName = personalName(input.firstName)
    lastName = personalName(input.lastName)
  } catch (error) {
    throw new ApiError(400, (error as Error).message)
  }
  const saved = await auth.client.rpc('update_player_identity', {
    identity_username: handle,
    given_name: firstName,
    family_name: lastName,
  })
  if (saved.error)
    throw new ApiError(
      saved.error.code === '23505' ? 409 : 400,
      saved.error.code === '23505'
        ? 'Username already taken.'
        : 'Your identity could not be saved. Check the fields and retry.',
    )
  return (await requireAuth(request, env)).user
}
