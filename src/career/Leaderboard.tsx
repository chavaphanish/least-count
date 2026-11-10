import { useAppViewport } from '../components/MobileOrientation'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCareer } from './useCareer'
import { PlayerIdentity } from './PlayerIdentity'
import { xpProgress } from './model'
import type { Ranking } from './model'
export function Leaderboard() {
  const { mobile, height } = useAppViewport()
  const pageSize = height < 400 ? 2 : 3
  const [localPage, setLocalPage] = useState(0)
  const auth = useAuth()
  const [scope, setScope] = useState('global')
  const [offset, setOffset] = useState(0)
  const { data, error, loading, refresh } = useCareer<Ranking>(
    `/career?op=leaderboard&scope=${scope}&offset=${offset}`,
    true,
  )
  const currentPage = Math.min(
    localPage,
    Math.max(0, Math.ceil((data?.players.length ?? 0) / pageSize) - 1),
  )
  const registered = auth.user?.player.accountType === 'registered'
  return (
    <section className="career-section leaderboard" aria-label="XP Ranking">
      <div className="career-heading">
        <div>
          <p className="eyebrow">THE LONG GAME</p>
          <h2>XP Ranking</h2>
        </div>
        <p>Participation and victories · not a skill rating</p>
      </div>
      <div className="career-tabs" role="group" aria-label="Leaderboard scope">
        {['global', 'buddies'].map((value) => (
          <button
            key={value}
            aria-pressed={scope === value}
            onClick={() => {
              setScope(value)
              setOffset(0)
              setLocalPage(0)
            }}
          >
            {value === 'global' ? 'Global Ranking' : 'Buddies Ranking'}
          </button>
        ))}
      </div>
      {scope === 'buddies' && !registered ? (
        <p>
          Create a verified account to compare with buddies.{' '}
          <a href="#/profile">Account options →</a>
        </p>
      ) : (
        <>
          {registered && <BuddyInbox />}
          {loading && !data && <p role="status">Loading rankings…</p>}
          {error && (
            <p role="status">
              {error}{' '}
              <button className="text-button" onClick={refresh}>
                Retry rankings
              </button>
            </p>
          )}
          {data && (
            <>
              {data.me && (
                <p className="ranking-self">
                  Your {scope === 'global' ? 'Global' : 'Buddies'} Rank: #
                  {data.me.rank} · {data.me.xp.toLocaleString()} XP · Level{' '}
                  {xpProgress(data.me.xp, data.me.levelBase).level}
                </p>
              )}
              {scope === 'buddies' && data.players.length <= 1 && (
                <p>
                  Add buddies to start competing with your friends.{' '}
                  <a href="#/profile">Add Buddies →</a>
                </p>
              )}
              {!data.players.length && (
                <p>No registered players in this ranking yet.</p>
              )}
              <ol className="ranking-list" start={offset + 1}>
                {(mobile
                  ? data.players.slice(
                      currentPage * pageSize,
                      (currentPage + 1) * pageSize,
                    )
                  : data.players
                ).map((p) => (
                  <li
                    key={p.id}
                    className={
                      p.rank !== null && p.rank <= 3 ? 'top-player' : ''
                    }
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
              <div className="career-pagination">
                <button
                  className="text-button"
                  disabled={(offset === 0 && currentPage === 0) || loading}
                  onClick={() => {
                    if (mobile && currentPage > 0) setLocalPage(currentPage - 1)
                    else {
                      setOffset((n) => n - 10)
                      setLocalPage(mobile ? Math.floor(9 / pageSize) : 0)
                    }
                  }}
                >
                  Previous players
                </button>
                <button
                  className="text-button"
                  disabled={
                    (!data.more &&
                      (!mobile ||
                        (currentPage + 1) * pageSize >= data.players.length)) ||
                    loading
                  }
                  onClick={() => {
                    if (
                      mobile &&
                      (currentPage + 1) * pageSize < data.players.length
                    )
                      setLocalPage(currentPage + 1)
                    else {
                      setOffset((n) => n + 10)
                      setLocalPage(0)
                    }
                  }}
                >
                  Next players
                </button>
              </div>
            </>
          )}
        </>
      )}
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
