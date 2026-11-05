import { useState } from 'react'
import type { PublicPlayer } from '../shared/multiplayer'
export function Avatar({
  player,
}: {
  player: Pick<PublicPlayer, 'displayName' | 'avatarUrl'>
}) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className="profile-avatar">
      {player.avatarUrl && failed !== player.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt={`${player.displayName}'s profile picture`}
          onError={() => setFailed(player.avatarUrl)}
        />
      ) : (
        <span aria-hidden="true">
          {player.displayName.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  )
}
