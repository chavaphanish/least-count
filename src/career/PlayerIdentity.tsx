import { Avatar } from '../components/Avatar'
import type { CareerPlayer } from './model'
import { xpProgress } from './model'
export function PlayerIdentity({ player }: { player: CareerPlayer }) {
  return (
    <div className="career-identity">
      <Avatar player={player} />
      <div>
        <a href={`#/player/${player.username}`}>{player.displayName}</a>
        <small>
          @{player.username} · Level{' '}
          {xpProgress(player.xp, player.levelBase).level}
        </small>
      </div>
    </div>
  )
}
