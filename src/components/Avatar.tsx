import { useState } from 'react'
import type { PlayerIdentityData } from '../shared/playerIdentity'
import { playerIdentity } from '../shared/playerIdentity'
export function Avatar({
  player,
}: {
  player: PlayerIdentityData
}) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className="profile-avatar">
      {player.avatarUrl && failed !== player.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt={`${playerIdentity(player).label}'s profile picture`}
          onError={() => setFailed(player.avatarUrl ?? null)}
        />
      ) : (
        <span aria-hidden="true">
          {(player.firstName && player.lastName ? `${player.firstName[0]}${player.lastName[0]}` : player.displayName.replace(/^@/, '').slice(0, 2)).toUpperCase()}
        </span>
      )}
    </span>
  )
}
