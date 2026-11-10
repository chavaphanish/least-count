/** Explicit public identity fields; never pass auth/session objects to public projections. */
export type PlayerIdentityData = {
  displayName: string
  username?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string | null
}
export function playerIdentity(player: PlayerIdentityData) {
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ').trim()
  const handle = player.username ? `@${player.username.replace(/^@/, '')}` : ''
  const primary = name || handle || player.displayName
  return { primary, secondary: name ? handle : '', label: name && handle ? `${name} (${handle})` : primary }
}

/** Decorate a presentation copy, preserving authoritative game state and old snapshots. */
export function withPlayerNames<T>(value: T, players: readonly (PlayerIdentityData & { id: string })[]): T {
  if (Array.isArray(value)) return value.map(item => withPlayerNames(item, players)) as T
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  const next = Object.fromEntries(Object.entries(object).map(([key, item]) => [key, withPlayerNames(item, players)]))
  const player = players.find(p => p.id === object.id)
  if (player && typeof object.name === 'string') next.name = playerIdentity(player).label
  return next as T
}
