import { useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCareer } from './useCareer'
import { PlayerIdentity } from './PlayerIdentity'
import type { Ranking } from './model'
type Scope = 'Global' | 'Buddies' | 'Achievements'

function useRankings(scope: 'global' | 'buddies', enabled: boolean) {
  const [offset, setOffset] = useState(0)
  const { data, error, loading, refresh } = useCareer<Ranking>(
    enabled ? `/career?op=leaderboard&scope=${scope}&offset=${offset}` : null,
  )
  const [pages, setPages] = useState<Record<number, Ranking>>({})
  useEffect(() => {
    if (data) setPages(previous => ({ ...previous, [offset]: data }))
  }, [data, offset])
  // Keep already loaded entries visible while the next server batch is fetched.
  const seen = new Set<string>()
  const loaded = data ? { ...pages, [offset]: data } : pages
  const players = Object.values(loaded).flatMap(page => page.players)
    .filter(player => {
      if (seen.has(player.id)) return false
      seen.add(player.id)
      return true
    })
  const me = data?.me ?? pages[0]?.me
  function loadMore() {
    if (data?.more && !loading && !error && pages[offset] === data)
      setOffset(offset + data.players.length)
  }
  return { players, me, data, loading, error, refresh, loadMore }
}

export function Leaderboard() {
  const { user } = useAuth()
  const registered = user?.player.accountType === 'registered'
  const [scope, setScope] = useState<Scope>('Global')
  const global = useRankings('global', true)
  const buddies = useRankings('buddies', registered)
  const { players, me, data, loading, error, refresh, loadMore } = scope === 'Buddies' ? buddies : global
  const inbox = useCareer<{ players: { relationship: string }[] }>(registered ? '/career?op=buddies' : null)
  const incoming = inbox.data?.players.filter(p => p.relationship === 'incoming').length ?? 0
  return (
    <section className="career-section leaderboard" aria-label="Leaderboards">
      <div className="leaderboard-layout">
        <div className="career-tabs" role="group" aria-label="Leaderboard scope">
          {(['Global', 'Buddies', 'Achievements'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="leaderboard-results" aria-label="Player rankings">
          {scope === 'Achievements' ? <p>Under construction</p> : scope === 'Buddies' && !registered ? (
            <p>
              Create a verified account to compare with buddies.{' '}
              <a href="#/profile">Account options →</a>
            </p>
          ) : (
            <>
              {incoming > 0 && <p className="invitation-banner"><a href="#/profile">{incoming} incoming buddy {incoming === 1 ? 'request' : 'requests'} · View your profile</a></p>}
              {loading && <p role="status">{players.length ? 'Loading more rankings…' : 'Loading rankings…'}</p>}
              {error && (
                <p role="status">
                  {error}{' '}
                  <button className="text-button" onClick={refresh}>
                    Retry rankings
                  </button>
                </p>
              )}
              {(data || players.length > 0) && (
                <>
                  {scope === 'Buddies' && players.length <= 1 && (
                    <p>
                      Add buddies to start competing with your friends.{' '}
                      <a href="#/profile">Add Buddies →</a>
                    </p>
                  )}
                  {!players.length && !loading && (
                    <p>No registered players in this ranking yet.</p>
                  )}
                  <div key={scope} className="ranking-frame" data-scrollable={players.length > 5}
                    style={{ '--ranking-count': Math.max(5, players.length) } as CSSProperties}>
                    <ol
                      className="ranking-list"
                      aria-label="Player rankings"
                      tabIndex={0}
                      onScroll={({ currentTarget }) => {
                        const range = currentTarget.scrollHeight - currentTarget.clientHeight
                        currentTarget.parentElement?.style.setProperty('--rows-scrolled', String(5 * currentTarget.scrollTop / currentTarget.clientHeight))
                        if (range > 0 && range - currentTarget.scrollTop < 2) loadMore()
                      }}
                    >
                      {players.map((p) => (
                        <li
                          key={p.id}
                          className={
                            [p.rank !== null && p.rank <= 3 ? 'top-player' : '', p.id === me?.id ? 'current-player' : ''].filter(Boolean).join(' ')
                          }
                          aria-current={p.id === me?.id ? 'true' : undefined}
                        >
                          <strong className="rank-number">#{p.rank}</strong>
                          <PlayerIdentity player={p} />
                          <div className="ranking-score">
                            <strong>{p.xp.toLocaleString()} XP</strong>
                            <small>
                              {p.gamesWon} wins ·{' '}
                              {p.gamesPlayed
                                ? Math.round((p.gamesWon / p.gamesPlayed) * 100)
                                : 0}
                              % win rate
                            </small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
