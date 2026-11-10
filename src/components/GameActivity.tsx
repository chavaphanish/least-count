import { useState } from 'react'
import type { GameEvent } from '../game/events'
import { formatGameEvent } from '../game/events'
import { useMobileLandscape } from './MobileOrientation'
import { PagedItems, ScreenPages } from './ScreenPages'
import { TableOverlay } from './TableOverlay'

/** The server owns history; toggling views only changes presentation. No scroll effects. */
export function GameActivity({ events }: { events: readonly GameEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<GameEvent | null>(null)
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
        {mobile ? (
          <button
            className="activity-entry"
            type="button"
            title="Read full activity"
            onClick={() => setDetail(event)}
          >
            {formatGameEvent(event)}
          </button>
        ) : (
          <span>{formatGameEvent(event)}</span>
        )}
      </li>
    ))
  if (mobile)
    return (
      <section
        className="game-activity compact-game-activity"
        aria-label="Game Activity"
      >
        <p
          className="latest-event latest-action"
          title={latest ? formatGameEvent(latest) : undefined}
          data-event-id={latest?.id}
          aria-live="polite"
        >
          {latest
            ? formatGameEvent(latest)
            : 'Your table is ready. Activity appears here.'}
        </p>
        <div className="activity-heading">
          <TableOverlay label="Game Activity" trigger="Activity">
            {detail ? (
              <>
                <button className="text-button" onClick={() => setDetail(null)}>
                  ← Back to activity
                </button>
                <ScreenPages
                  key={detail.id}
                  label="Activity detail sections"
                  pages={messagePages(formatGameEvent(detail)).map(
                    (content, i, pages) => ({
                      label: `Activity · part ${i + 1} of ${pages.length}`,
                      content: <p className="activity-detail">{content}</p>,
                    }),
                  )}
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="text-button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? 'Recent Activity' : 'View Full History'}
                </button>
                <p className="field-hint">Tap an activity for full details.</p>
                <PagedItems
                  ariaLabel={
                    expanded ? 'Full game history' : 'Recent game activity'
                  }
                  as="ol"
                  className={expanded ? 'full-history' : 'recent-history'}
                  label="activities"
                  size={expanded ? 3 : 5}
                >
                  {render(expanded ? events : events.slice(-5).reverse())}
                </PagedItems>
              </>
            )}
          </TableOverlay>
        </div>
      </section>
    )
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

/** Bound text per detail screen while retaining every word of long public score summaries. */
function messagePages(message: string) {
  const pages: string[] = []
  let rest = message
  while (rest.length > 180) {
    const space = rest.lastIndexOf(' ', 180)
    const cut = space > 0 ? space : 180
    pages.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  pages.push(rest)
  return pages
}
