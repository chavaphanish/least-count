import { Children } from 'react'
import type { ReactNode } from 'react'
import type { PublicPlayer } from '../shared/multiplayer'
import { Avatar } from './Avatar'

/** Keep each exposed card strip selectable, even in a large penalty hand. */
export function PlayerHand({
  player,
  total,
  score,
  children,
  empty,
  active = false,
  timer,
}: {
  player: Pick<PublicPlayer, 'displayName' | 'avatarUrl'>
  total: number
  score: number
  children: ReactNode
  empty: ReactNode
  active?: boolean
  timer?: ReactNode
}) {
  const cards = Children.toArray(children)
  const rows = Array.from({ length: Math.ceil(cards.length / 7) }, (_, i) =>
    cards.slice(i * 7, (i + 1) * 7),
  )
  return (
    <div className="your-live-seat">
      <div className="hand-heading">
        <div className={`hand-player ${active ? 'active-hand-player' : ''}`}>
          <Avatar player={player} />
          <div>
            <h2>Your hand</h2>
            <span className="hand-player-name">{player.displayName}</span>
          </div>
        </div>
        {timer}
        <div className="hand-summary">
          <strong data-testid="hand-total">{total} points</strong>
          <span>{cards.length} cards · {score} cumulative</span>
        </div>
      </div>
      <div className="player-hand" role="group" aria-label="Your hand">
        {rows.map((row, i) => (
          <div className="hand-row" key={i}>{row}</div>
        ))}
        {!cards.length && <p className="empty-hand">{empty}</p>}
      </div>
    </div>
  )
}
