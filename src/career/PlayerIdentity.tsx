import { PlayerIdentity as Identity } from '../components/PlayerIdentity'
import type { CareerPlayer } from './model'
import { xpProgress } from './model'
export function PlayerIdentity({ player }: { player: CareerPlayer }) {
  return <div className="career-identity"><div>
    <Identity player={player} avatar href={`#/player/${player.username}`} />
    <small>Level {xpProgress(player.xp, player.levelBase).level}</small>
  </div></div>
}
