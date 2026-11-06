import { useState } from 'react'
import { useCareer } from './useCareer'
import { PlayerIdentity } from './PlayerIdentity'
import { BuddyAction } from './BuddyAction'
import type { CareerPlayer, Relationship } from './model'
type SocialPlayer = CareerPlayer & { relationship: Relationship }
export function Buddies() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const list = useCareer<{ players: SocialPlayer[]; blocked: CareerPlayer[] }>(
    '/career?op=buddies',
    true,
  )
  const found = useCareer<SocialPlayer[]>(
    search ? `/career?op=search&query=${encodeURIComponent(search)}` : null,
  )
  const refresh = () => {
    list.refresh()
    found.refresh()
  }
  return (
    <section className="career-section" aria-label="Buddies">
      <h2>Your circle</h2>
      <form
        className="player-search"
        onSubmit={(event) => {
          event.preventDefault()
          setSearch(query.trim())
        }}
      >
        <label>
          Find registered players
          <input
            minLength={2}
            maxLength={64}
            required
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Display name or public username"
          />
        </label>
        <button className="button button-secondary">Search players</button>
      </form>
      {(list.error || found.error) && (
        <p role="status">
          {list.error || found.error}{' '}
          <button className="text-button" onClick={refresh}>
            Retry buddies
          </button>
        </p>
      )}
      {found.data && (
        <>
          <h3>Search results</h3>
          {!found.data.length && <p>No matching registered players.</p>}
          <ul className="social-list">
            {found.data.map((p) => (
              <li key={p.id}>
                <PlayerIdentity player={p} />
                <BuddyAction
                  id={p.id}
                  relationship={p.relationship}
                  onChange={refresh}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {(['incoming', 'outgoing', 'accepted'] as const).map((status) => (
        <div key={status}>
          <h3>
            {status === 'incoming'
              ? 'Incoming requests'
              : status === 'outgoing'
                ? 'Sent requests'
                : 'Accepted buddies'}
          </h3>
          <ul className="social-list">
            {list.data?.players
              .filter((p) => p.relationship === status)
              .map((p) => (
                <li key={p.id}>
                  <PlayerIdentity player={p} />
                  <div>
                    <small>
                      {p.xp} XP · Global #{p.rank ?? '—'}
                    </small>
                    <BuddyAction
                      id={p.id}
                      relationship={p.relationship}
                      onChange={refresh}
                      blocking
                    />
                  </div>
                </li>
              ))}
          </ul>
          {!list.data?.players.some((p) => p.relationship === status) && (
            <p className="field-hint">
              {status === 'incoming'
                ? 'No incoming requests.'
                : status === 'outgoing'
                  ? 'No sent requests.'
                  : 'Add buddies to start your circle.'}
            </p>
          )}
        </div>
      ))}
      {!!list.data?.blocked.length && (
        <>
          <h3>Blocked players</h3>
          <ul className="social-list">
            {list.data.blocked.map((p) => (
              <li key={p.id}>
                <span>
                  {p.displayName} · @{p.username}
                </span>
                <BuddyAction
                  id={p.id}
                  relationship="blocked"
                  onChange={refresh}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
