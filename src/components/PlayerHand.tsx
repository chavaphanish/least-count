import { Children } from 'react'
import type { ReactNode } from 'react'
import { PlayerIdentity } from './PlayerIdentity'
import type { PlayerIdentityData } from '../shared/playerIdentity'
import { Avatar } from './Avatar'
import { AdaptiveHand } from './AdaptiveHand'

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
  player: PlayerIdentityData
  total: number
  score: number
  children: ReactNode
  empty: ReactNode
  active?: boolean
  timer?: ReactNode
}) {
  const cards = Children.toArray(children)
  return (
    <div className="your-live-seat">
      <div className="hand-heading">
        <div className={`hand-player ${active ? 'active-hand-player' : ''}`}>
          <Avatar player={player} />
          <div>
            <h2>Your hand</h2>
            <span className="hand-player-name"><PlayerIdentity player={player} compact /></span>
          </div>
        </div>
        {timer}
        <div className="hand-summary">
          <strong data-testid="hand-total">{total} points</strong>
          <span>
            {cards.length} cards · {score} cumulative
          </span>
        </div>
      </div>
      <AdaptiveHand empty={empty}>{children}</AdaptiveHand>
    </div>
  )
}
