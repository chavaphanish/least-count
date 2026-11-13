import { ScreenPages, PagedItems } from '../components/ScreenPages'
import { useMobileLandscape } from '../components/MobileOrientation'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { PlayerIdentity as Identity } from '../components/PlayerIdentity'
import { playerIdentity } from '../shared/playerIdentity'
import { Avatar } from '../components/Avatar'
import { useCareer } from './useCareer'
import { BuddyAction } from './BuddyAction'
import { Buddies } from './Buddies'
import { PlayerIdentity } from './PlayerIdentity'
import { METRIC_GROUPS, duration, xpProgress } from './model'
import type { CareerData, GameReport, Metrics } from './model'
const percentage = (n: number, d: number) =>
  d ? `${Math.round((n / d) * 100)}%` : '—'
const average = (n: number, d: number) => (d ? (n / d).toFixed(1) : '—')
function metric(stats: Metrics, key: string) {
  const n = stats[key]
  if (
    n === undefined &&
    ['fastestMs', 'slowestMs', 'lowestHand', 'highestHand'].includes(key)
  )
    return '—'
  return key.endsWith('Ms') ? duration(n ?? 0) : (n ?? 0).toLocaleString()
}
export function CareerProfile({
  username,
  onEdit,
}: {
  username?: string
  onEdit?: () => void
}) {
  const mobile = useMobileLandscape()
  const auth = useAuth()
  const [tab, setTab] = useState('Overview')
  const [offset, setOffset] = useState(0)
  const resource = useCareer<CareerData>(
    `/career?op=${username ? 'public' : 'profile'}${username ? `&username=${encodeURIComponent(username)}` : ''}&offset=${offset}`,
    true,
  )
  const { data, error, loading, refresh } = resource
  if (!data)
    return (
      <section className="career-section">
        <p role="status">{error || 'Loading player career…'}</p>
        {error && (
          <button className="text-button" onClick={refresh}>
            Retry career data
          </button>
        )}
        {onEdit && (
          <button className="button button-secondary" onClick={onEdit}>
            Edit Profile
          </button>
        )}
      </section>
    )
  const p =
    data.own && auth.user
      ? {
          ...data.profile,
          displayName: auth.user.player.displayName,
          ...(auth.user.player.username ? {
            username: auth.user.player.username,
            firstName: auth.user.player.firstName,
            lastName: auth.user.player.lastName,
          } : {}),
          avatarUrl: auth.user.player.avatarUrl,
        }
      : data.profile
  const stats = data.statistics ?? {}
  const xp = xpProgress(p.xp, data.config.levelBase)
  const NameHeading = username ? 'h1' : 'h2'
  const tabs = data.own
    ? ['Overview', 'Statistics', 'Game History', 'Buddies']
    : ['Overview']
  const overviewDetails = (
    <>
      <p className="field-hint">
        Verified career games only. Earlier matches are not backfilled. Mixed
        guest rooms and local practice remain casual.
      </p>
      <div className="career-summary">
        {Object.entries({
          'Average Move Time': stats.completedTurns
            ? duration((stats.decisionMs ?? 0) / stats.completedTurns)
            : '—',
          'Total Playing Time': duration(stats.playingMs ?? 0),
          'Least Success Rate': percentage(
            stats.successfulDeclarations ?? 0,
            stats.declarations ?? 0,
          ),
          'Current Win Streak': stats.currentWinStreak ?? 0,
        }).map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </>
  )
  return (
    <section
      className="career-profile"
      data-career-tab={tab}
      aria-label="Player career"
    >
      <header className="career-profile-header">
        <Avatar player={p} />
        <div>
          <p className="eyebrow">
            LEVEL {xp.level} · {p.xp.toLocaleString()} XP
          </p>
          <NameHeading><Identity player={p} /></NameHeading>
          <small>
            Joined {new Date(p.createdAt).toLocaleDateString()} · Global #
            {p.rank ?? '—'}
          </small>
        </div>
        {data.own ? (
          <a
            className="button button-secondary compact-button"
            href={username ? '#/profile' : '#profile-editor'}
            onClick={(e) => {
              if (mobile && onEdit) {
                e.preventDefault()
                onEdit()
                return
              }
              if (username) return
              e.preventDefault()
              document
                .getElementById('profile-editor')
                ?.scrollIntoView({ block: 'center' })
              ;(
                document.getElementById('identity-username') ??
                document.getElementById('profile-name')
              )?.focus()
            }}
          >
            Edit Profile
          </a>
        ) : (
          <BuddyAction
            id={p.id}
            relationship={data.relationship}
            onChange={refresh}
            blocking
          />
        )}
      </header>
      <div className="xp-progress">
        <label htmlFor="career-xp">
          Level {xp.level} → {xp.level + 1} · {xp.earned.toLocaleString()} /{' '}
          {xp.needed.toLocaleString()} XP
        </label>
        <progress id="career-xp" max={xp.needed} value={xp.earned} />
        <small>{(xp.next - p.xp).toLocaleString()} XP to the next level</small>
      </div>
      {error && <p role="status">Could not refresh: {error}</p>}
      <div className="career-tabs" role="group" aria-label="Profile sections">
        {tabs.map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value)
              setOffset(0)
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="career-tab-content">
        {tab === 'Overview' && (
          <ScreenPages
            label="Overview sections"
            pages={[
              {
                label: 'Summary',
                content: (
                  <>
                    <div className="career-summary">
                      {Object.entries({
                        'Games Played': p.gamesPlayed,
                        'Games Won': p.gamesWon,
                        'Win Rate': percentage(p.gamesWon, p.gamesPlayed),
                        ...(data.own
                          ? { 'Rounds Played': stats.roundsPlayed ?? 0 }
                          : {}),
                      }).map(([label, value]) => (
                        <div key={label}>
                          <strong>{value}</strong>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                    {data.own && overviewDetails}
                    {!data.own && (
                      <p className="field-hint">
                        Detailed statistics, game history, and frequent
                        opponents are private to the player.
                      </p>
                    )}
                  </>
                ),
              },
              ...(data.own
                ? [
                    {
                      label: 'Recent Games',
                      content: (
                        <History games={(data.games ?? []).slice(0, 5)} />
                      ),
                    },
                    {
                      label: 'Opponents',
                      content: <Opponents data={data} refresh={refresh} />,
                    },
                  ]
                : []),
            ]}
          />
        )}
        {tab === 'Statistics' && data.own && (
          <>
            <div className="career-summary">
              <div>
                <strong>
                  {average(stats.finalizedRounds ?? 0, p.gamesPlayed)}
                </strong>
                <span>Rounds per finalized game</span>
              </div>
              <div>
                <strong>
                  {average(stats.declaredTotal ?? 0, stats.declarations ?? 0)}
                </strong>
                <span>Average declared hand</span>
              </div>
              <div>
                <strong>
                  {average(
                    stats.roundPenalties ?? 0,
                    stats.roundsCompleted ?? 0,
                  )}
                </strong>
                <span>Average completed-round penalty</span>
              </div>
            </div>
            <ScreenPages
              label="Statistic groups"
              pages={Object.entries(METRIC_GROUPS).map(([group, metrics]) => ({
                label: group,
                content: (
                  <section className="career-section" key={group}>
                    <h3>{group}</h3>
                    <PagedItems
                      as="dl"
                      className="metric-list"
                      label="metrics"
                      size={4}
                    >
                      {Object.entries(metrics).map(([key, label]) => (
                        <div key={key}>
                          <dt
                            title={
                              key.endsWith('Ms')
                                ? 'Server-recorded durations; animation time cannot be separated from elapsed turn time.'
                                : 'Accepted server game events only. See career definitions in the README.'
                            }
                          >
                            {label}
                          </dt>
                          <dd>{metric(stats, key)}</dd>
                        </div>
                      ))}
                    </PagedItems>
                  </section>
                ),
              }))}
            />
          </>
        )}
        {tab === 'Game History' && data.own && (
          <>
            <p className="field-hint">
              Started games stay active until finalized or abandoned.
              Score/timeout elimination is recorded as a loss once the match
              finishes.
            </p>
            <History games={data.games ?? []} />
            <div className="career-pagination">
              <button
                className="text-button"
                disabled={!offset || loading}
                onClick={() => setOffset((n) => n - 20)}
              >
                Previous games
              </button>
              <button
                className="text-button"
                disabled={(data.games?.length ?? 0) < 20 || loading}
                onClick={() => setOffset((n) => n + 20)}
              >
                Next games
              </button>
            </div>
          </>
        )}
        {tab === 'Buddies' && data.own && (
          <>
            <Buddies />
            {!mobile && (
              <>
                <h3>Most Played Against</h3>
                <Opponents data={data} refresh={refresh} />
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
function Opponents({
  data,
  refresh,
}: {
  data: CareerData
  refresh: () => void
}) {
  return (
    <>
      {!data.opponents?.length && (
        <p className="field-hint">
          Finish career games to discover your frequent opponents.
        </p>
      )}
      <PagedItems as="ul" className="social-list" label="opponents" size={2}>
        {data.opponents?.map((p) => (
          <li key={p.id}>
            <PlayerIdentity player={p} />
            <div>
              <p>
                {p.gamesTogether} games together · {p.wins} wins / {p.losses}{' '}
                losses
              </p>
              <small>
                Last shared game: {new Date(p.lastGame).toLocaleDateString()}
              </small>
              <BuddyAction
                id={p.id}
                relationship={p.relationship}
                onChange={refresh}
              />
            </div>
          </li>
        ))}
      </PagedItems>
    </>
  )
}
function History({ games }: { games: GameReport[] }) {
  const auth = useAuth()
  const uid = auth.user!.player.id
  return (
    <>
      {!games.length && <p className="field-hint">No recorded games yet.</p>}
      <PagedItems as="ul" className="history-list" label="history" size={2}>
        {games.map((game) => {
          const own = game.players.find((p) => p.id === uid)
          return (
            <li key={game.id}>
              <a href={`#/history/${game.id}`}>
                {game.completedAt
                  ? new Date(game.completedAt).toLocaleString()
                  : 'In progress'}{' '}
                · {own?.outcome ?? game.status}
              </a>
              <p>
                {game.players.length} players ·{' '}
                {game.roundCount ?? game.rounds.length} rounds · Score{' '}
                {own?.score ?? '—'} · Place {own?.rank ?? '—'} · {game.xp ?? 0}{' '}
                XP
              </p>
              <small>
                {game.players
                  .filter((p) => p.id !== uid)
                  .map((p) => playerIdentity({ ...p, displayName: p.name }).label)
                  .join(', ')}{' '}
                · {duration(own?.stats.playingMs ?? 0)}
              </small>
            </li>
          )
        })}
      </PagedItems>
    </>
  )
}
export function GameHistoryReport({ id }: { id: string }) {
  const auth = useAuth()
  const { data, error, refresh } = useCareer<GameReport>(
    `/career?op=game&game=${encodeURIComponent(id)}`,
  )
  const mine = data?.players.find((p) => p.id === auth.user!.player.id)
  return (
    <section className="career-section game-report">
      <a href="#/profile" className="text-link">
        ← Player profile
      </a>
      <h1>Game report</h1>
      {!data ? (
        <p role="status">
          {error || 'Loading report…'}
          {error && (
            <button className="text-button" onClick={refresh}>
              Retry report
            </button>
          )}
        </p>
      ) : (
        <ScreenPages
          label="Report sections"
          pages={[
            {
              label: 'Summary',
              content: (
                <>
                  <p>
                    {data.status} · {data.players.length} players ·{' '}
                    {data.rounds.length} rounds · {data.xp ?? 0} XP earned
                  </p>
                  <p>
                    {mine?.stats.completedTurns ?? 0} completed turns · Average
                    move{' '}
                    {mine?.stats.completedTurns
                      ? duration(
                          (mine.stats.decisionMs ?? 0) /
                            mine.stats.completedTurns,
                        )
                      : '—'}
                  </p>
                  <p className="field-hint">
                    Historical private hands are never stored in these reports.
                  </p>
                  <PagedItems as="ul" label="players" size={3}>
                    {data.players.map((p) => (
                      <li key={p.id}>
                        <Identity player={{ ...p, displayName: p.name }} compact /> · {p.outcome} · score {p.score} · place{' '}
                        {p.rank ?? '—'}
                        {p.elimination === 'score'
                          ? ' · score eliminated'
                          : p.elimination === 'timeout'
                            ? ' · timeout eliminated'
                            : ''}
                      </li>
                    ))}
                  </PagedItems>
                </>
              ),
            },
            ...data.rounds.map((round) => ({
              label: `Round ${round.round}`,
              content: (
                <section className="career-section" key={round.round}>
                  <h2>Round {round.round}</h2>
                  <p>
                    {round.reason === 'show'
                      ? `Least ${round.successful ? 'successful' : 'failed'}`
                      : round.reason}
                  </p>
                  <PagedItems as="ul" label="scores" size={3}>
                    {round.scores.map((score) => (
                      <li key={score.id}>
                        <Identity player={{ ...score, displayName: score.name }} compact />: hand {score.total}, +{score.penalty}{' '}
                        penalty, {score.score} cumulative{score.forfeited ? ' · Forfeited' : ''}
                      </li>
                    ))}
                  </PagedItems>
                </section>
              ),
            })),
          ]}
        />
      )}
    </section>
  )
}
