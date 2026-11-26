import { useId, useRef, useState } from 'react'
import { useCareer } from './useCareer'
import { duration } from './model'
import type { CareerData } from './model'
import './my-profile.css'

const tabs = ['Overview', 'Stats'] as const

export function MyProfile() {
  const { data, error, refresh } = useCareer<CareerData>('/career?op=profile', true)
  const [selected, setSelected] = useState(0)
  const id = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const p = data?.profile
  const stats = data?.statistics ?? {}
  const joined = new Date(p?.createdAt ?? '')
  const joinedLabel = Number.isNaN(joined.getTime()) ? '—' : joined.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const winRate = p?.gamesPlayed ? `${Math.round(p.gamesWon / p.gamesPlayed * 100)}%` : '—'
  const summary = p ? {
    'Games played': p.gamesPlayed,
    Wins: p.gamesWon,
    Losses: stats.gamesLost ?? '—',
    'Win rate': winRate,
    'Rounds played': stats.roundsPlayed ?? 0,
    'Rounds completed': stats.roundsCompleted ?? 0,
    'Successful Least': stats.successfulDeclarations ?? 0,
    'Power Card 7 actions': stats.sevenActions ?? 0,
    'Round forfeits': stats.roundForfeits ?? 0,
    'Current win streak': stats.currentWinStreak ?? 0,
    'Best win streak': stats.bestWinStreak ?? 0,
    'Playing time': duration(stats.playingMs ?? 0),
  } : {}
  return <section className="career-section leaderboard my-profile-page" aria-label="My Profile">
    <div className="leaderboard-layout">
      <div className="career-tabs" role="tablist" aria-orientation="vertical" aria-label="Profile sections">
        {tabs.map((tab, index) => <button key={tab} type="button" role="tab"
          id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`}
          aria-selected={selected === index} aria-pressed={selected === index}
          tabIndex={selected === index ? 0 : -1}
          ref={element => { buttons.current[index] = element }}
          onClick={() => setSelected(index)}
          onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? (index + 1) % tabs.length
              : event.key === 'ArrowUp' ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
            if (next === null) return
            event.preventDefault(); setSelected(next); buttons.current[next]?.focus()
          }}>{tab}</button>)}
      </div>
      <div className="leaderboard-results my-profile-content">
        {error && <p role="status" className="my-profile-notice">{data ? `Could not refresh: ${error}` : error} <button className="text-button" onClick={refresh}>Retry career data</button></p>}
        {!data && !error && <p role="status">Loading player career…</p>}
        <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={selected !== 0}>
          {p && <>
            <dl className="my-profile-grid my-profile-essentials">
              {Object.entries({ 'Member since': joinedLabel, 'Global ranking': p.rank ? `#${p.rank}` : 'Unranked', 'Career games': p.gamesPlayed }).map(([label, value]) =>
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <section className="my-profile-highlights" aria-label="Career highlights">
              <h2>Career highlights</h2>
              <dl className="my-profile-grid">
                {Object.entries({ 'Best win streak': stats.bestWinStreak ?? 0, 'Successful Least': stats.successfulDeclarations ?? 0, 'Win Rate': winRate }).map(([label, value]) =>
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            </section>
          </>}
        </div>
        <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={selected !== 1}>
          {p && <dl className="my-profile-grid my-profile-stats">
            {Object.entries(summary).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>}
        </div>
      </div>
    </div>
  </section>
}
