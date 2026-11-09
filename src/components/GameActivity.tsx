import { useState } from 'react'
import type { GameEvent } from '../game/events'
import { formatGameEvent } from '../game/events'
import { useMobileLandscape } from './MobileOrientation'
import { TableOverlay } from './TableOverlay'

/** The server owns history; toggling views only changes presentation. No scroll effects. */
export function GameActivity({ events }: { events: readonly GameEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  const latest = events.at(-1)
  const mobile = useMobileLandscape()
  const render = (entries: readonly GameEvent[]) =>
    entries.map((event) => (
      <li
        key={event.id}
        data-event-id={event.id}
        className={event.id === latest?.id ? 'latest-event' : ''}
      >
        <span className="event-round">
          {event.roundNumber
            ? `Round ${event.roundNumber}`
            : 'Earlier activity'}
        </span>
        <span>{formatGameEvent(event)}</span>
      </li>
    ))
  if (mobile) return <section className="game-activity compact-game-activity" aria-label="Game Activity">
    <p className="latest-event latest-action" title={latest ? formatGameEvent(latest) : undefined} data-event-id={latest?.id} aria-live="polite">{latest ? formatGameEvent(latest) : 'Your table is ready. Activity appears here.'}</p>
    <div className="activity-heading"><TableOverlay label="Game Activity" trigger="Activity ↗">
      <button type="button" className="text-button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Recent Activity':'View Full History'}</button>
      <ol className={expanded?'full-history':'recent-history'} aria-label={expanded?'Full game history':'Recent game activity'}>{render(expanded?events:events.slice(-5).reverse())}</ol>
    </TableOverlay></div>
  </section>
  return (
    <section
      className={`game-activity ${expanded ? 'history-expanded' : ''}`}
      aria-label="Game Activity"
    >
      <div className="activity-heading">
        <h2>Game Activity</h2>
        <button
          type="button"
          className="text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Recent Activity' : 'View Full History'}
        </button>
      </div>
      {!events.length && (
        <p>Actions will appear here as the game progresses.</p>
      )}
      {expanded ? (
        <ol
          className="full-history"
          tabIndex={0}
          aria-label="Full game history"
        >
          {render(events)}
        </ol>
      ) : (
        <>
          <ol className="compact-desktop" aria-label="Recent game activity">
            {render(events.slice(-5).reverse())}
          </ol>
          <ol className="compact-mobile" aria-label="Recent game activity">
            {render(events.slice(-3).reverse())}
          </ol>
        </>
      )}
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {latest ? formatGameEvent(latest) : ''}
      </p>
    </section>
  )
}
