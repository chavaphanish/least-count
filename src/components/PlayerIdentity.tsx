import type { PlayerIdentityData } from '../shared/playerIdentity'
import { playerIdentity } from '../shared/playerIdentity'
import { Avatar } from './Avatar'

export function PlayerIdentity({
  player,
  compact = false,
  avatar = false,
  href,
}: {
  player: PlayerIdentityData
  compact?: boolean
  avatar?: boolean
  href?: string
}) {
  const identity = playerIdentity(player)
  const text = (
    <span className="identity-text">
      <span className="identity-primary">{identity.primary}</span>
      {identity.secondary && (
        <small className="identity-username">{identity.secondary}</small>
      )}
    </span>
  )
  return (
    <span
      className={`player-identity${compact ? ' identity-compact' : ''}`}
      title={identity.label}
    >
      {avatar && <Avatar player={player} />}
      {href ? <a href={href} aria-label={identity.label}>{text}</a> : text}
    </span>
  )
}
