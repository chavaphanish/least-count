import { formatGameEvent } from '../game/events'
import type { GameEvent } from '../game/events'
import './game-notices.css'

export function GameNotices({ events, now, hostName }: { events: readonly GameEvent[]; now: number; hostName?: string }) {
  const forfeit = events.filter(event => event.type === 'PLAYER_FORFEITED').at(-1)
  const message = forfeit && now - forfeit.timestamp >= 0 && now - forfeit.timestamp < 8000 ? formatGameEvent(forfeit) : ''
  if (!message && !hostName) return null
  return <div className="game-notices" role="status">
    {message && <p>{message}</p>}
    {hostName && <p>{hostName} is now the host.</p>}
  </div>
}
