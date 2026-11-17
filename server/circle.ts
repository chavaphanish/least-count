import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from './http'
import type { Env } from './types'

function circleClient(env: Env, url: string) {
  return createClient(url, env.SUPABASE_CAREER_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) }) },
  })
}

/** Candidate lookup only. Public profiles and relationship permissions still come from the authenticated gateway. */
export async function searchCircle(client: SupabaseClient, env: Env, url: string, uid: string, query: string) {
  const term = query.trim().replace(/^@/, '')
  if (term.length < 2) return []
  if (term.length > 64) throw new ApiError(400, 'Enter a username of at most 64 characters.')
  const escaped = term.replace(/[\\%_]/g, '\\$&')
  const candidates = await circleClient(env, url).from('career_public_profiles')
    .select('username').ilike('username', `%${escaped}%`).neq('id', uid).order('username').limit(20)
  if (candidates.error) throw new ApiError(503, 'Player search is unavailable. Please retry.')
  const players: Record<string, unknown>[] = []
  // Bound concurrency and reuse the existing public projection, block checks and relationship rules.
  const rows = candidates.data ?? []
  for (let start = 0; start < rows.length; start += 4) {
    const results = await Promise.all(rows.slice(start, start + 4).map(async ({ username }) => {
      const result = await client.rpc('career_api', { operation: 'public', args: { username } })
      if (result.error) {
        if (result.error.code === 'P0001') return null // Blocked or removed since candidate lookup.
        throw new ApiError(503, 'Player search is unavailable. Please retry.')
      }
      const data = result.data
      if (!data?.profile || data.profile.id === uid || data.relationship === 'blocked') return null
      return { ...data.profile, relationship: data.relationship }
    }))
    for (const player of results) if (player) players.push(player)
  }
  return players
}

export async function circleGames(env: Env, url: string, uid: string, players: Record<string, unknown>[]) {
  const accepted = players.filter(p => p.relationship === 'accepted').map(p => String(p.id))
  if (!accepted.length) return players
  const service = circleClient(env, url), counts = new Map<string, number>()
  // Scope every query to the authenticated owner; filter friends before ranking/limiting in the UI.
  for (let start = 0; start < accepted.length; start += 100) {
    const result = await service.from('career_opponents').select('opponent_id,games')
      .eq('user_id', uid).in('opponent_id', accepted.slice(start, start + 100))
    if (result.error) throw new ApiError(503, 'Shared game counts could not be loaded. Please retry.')
    for (const row of result.data ?? []) counts.set(row.opponent_id, row.games)
  }
  return players.map(p => ({ ...p, gamesTogether: p.relationship === 'accepted' ? counts.get(String(p.id)) ?? 0 : 0 }))
}
