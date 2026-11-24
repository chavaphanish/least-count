import { formatGameEvent } from '../game/events'
import type { GameEvent } from '../game/events'

export function GameActivity({ events }: { events: readonly GameEvent[] }) {
  const latest = events.at(-1)
  return <p className="table-latest-action" aria-label="Latest game action" aria-live="polite" data-event-id={latest?.id}>
    {latest && formatGameEvent(latest)}
  </p>
}
