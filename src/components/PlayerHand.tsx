import { Children, isValidElement, useLayoutEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { PublicPlayer } from '../shared/multiplayer'
import { Avatar } from './Avatar'
import { useMobileLandscape } from './MobileOrientation'

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
  const mobile = useMobileLandscape()
  const [requestedPage, setPage] = useState(0)
  const pageSize = mobile && cards.length > 7 ? 5 : 7
  const rows = Array.from({ length: Math.ceil(cards.length / pageSize) }, (_, i) =>
    cards.slice(i * pageSize, (i + 1) * pageSize),
  )
  const incoming = cards.findIndex(card => isValidElement<{className?:string}>(card) && card.props.className?.includes('incoming-card-placeholder'))
  const page = Math.max(0, Math.min(incoming >= 0 ? Math.floor(incoming/pageSize) : requestedPage, rows.length - 1))
  useLayoutEffect(() => { if (incoming >= 0) setPage(Math.floor(incoming/pageSize)) }, [incoming,pageSize])
  const paged = mobile && rows.length > 1
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
      <div className={`player-hand ${paged?'paged-hand':''}`} role="group" aria-label="Your hand" data-hand-target>
        {paged && <button className="hand-page previous-hand-page" type="button" aria-label="Previous hand page" disabled={page===0} onClick={()=>setPage(page-1)}>‹</button>}
        {rows.map((row, i) => (
          <div className="hand-row" key={`${pageSize}-${i}`} hidden={mobile && i!==page} style={{'--hand-gaps':Math.max(1,row.length-1)} as CSSProperties}>{row}</div>
        ))}
        {paged && <button className="hand-page next-hand-page" type="button" aria-label="Next hand page" disabled={page===rows.length-1} onClick={()=>setPage(page+1)}>›</button>}
        {!cards.length && <p className="empty-hand">{empty}</p>}
      </div>
      {paged && <span className="hand-page-count" aria-live="polite">{page*pageSize+1}–{Math.min(cards.length,(page+1)*pageSize)} of {cards.length}</span>}
    </div>
  )
}
