import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCareer } from './useCareer'
import { PlayerIdentity } from './PlayerIdentity'
import { xpProgress } from './model'
import type { Ranking } from './model'
export function Leaderboard() {
  const auth = useAuth()
  const [scope, setScope] = useState('global')
  const [offset, setOffset] = useState(0)
  const { data, error, loading, refresh } = useCareer<Ranking>(
    `/career?op=leaderboard&scope=${scope}&offset=${offset}`,
    true,
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
  const registered = auth.user?.player.accountType === 'registered'
  return (
    <section className="career-section leaderboard" aria-labelledby="leaderboards-title">
      <h1 id="leaderboards-title">Leaderboards</h1>
      <div className="leaderboard-layout">
        <div className="career-tabs" role="group" aria-label="Leaderboard scope">
          {['global', 'buddies'].map((value) => (
            <button
              key={value}
              aria-pressed={scope === value}
              onClick={() => {
                if (value === scope) return
                setScope(value)
                setOffset(0)
                setPages({})
              }}
            >
              {value === 'global' ? 'Global Ranking' : 'Buddies Ranking'}
            </button>
          ))}
        </div>
        <div className="leaderboard-results" aria-label="Player rankings">
          {scope === 'buddies' && !registered ? (
            <p>
              Create a verified account to compare with buddies.{' '}
              <a href="#/profile">Account options →</a>
            </p>
          ) : (
            <>
              {registered && <BuddyInbox />}
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
                  {me && (
                    <p className="ranking-self">
                      Your {scope === 'global' ? 'Global' : 'Buddies'} Rank: #
                      {me.rank} · {me.xp.toLocaleString()} XP · Level{' '}
                      {xpProgress(me.xp, me.levelBase).level}
                    </p>
                  )}
                  {scope === 'buddies' && players.length <= 1 && (
                    <p>
                      Add buddies to start competing with your friends.{' '}
                      <a href="#/profile">Add Buddies →</a>
                    </p>
                  )}
                  {!players.length && !loading && (
                    <p>No registered players in this ranking yet.</p>
                  )}
                  <ol
                    key={scope}
                    className="ranking-list"
                    aria-label="Player rankings"
                    tabIndex={0}
                    onScroll={({ currentTarget }) => {
                      if (data?.more && !loading && !error && pages[offset] === data &&
                        currentTarget.scrollHeight - currentTarget.scrollTop - currentTarget.clientHeight < 2)
                        setOffset(value => value + 10)
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
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function BuddyInbox() {
  const { data } = useCareer<{ players: { relationship: string }[] }>(
    '/career?op=buddies',
    true,
  )
  const count =
    data?.players.filter((p) => p.relationship === 'incoming').length ?? 0
  return count ? (
    <p className="invitation-banner">
      <a href="#/profile">
        {count} incoming buddy {count === 1 ? 'request' : 'requests'} · View
        your profile
      </a>
    </p>
  ) : null
}
