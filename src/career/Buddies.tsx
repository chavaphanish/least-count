import { useState } from 'react'
import { PlayerIdentity } from '../components/PlayerIdentity'
import { playerIdentity } from '../shared/playerIdentity'
import { useFriendsPresence } from '../presence/PresenceProvider'
import { useAuth } from '../auth/AuthProvider'
import { useCareer } from './useCareer'
import { RankingList } from './RankingList'
import { BuddyAction } from './BuddyAction'
import { xpProgress } from './model'
import type { CareerPlayer, Relationship } from './model'

type SocialPlayer = CareerPlayer & { relationship: Relationship; gamesTogether?: number }
const tabs = ['All Friends', 'Favourites', 'Currently Online', 'Friend Requests'] as const
type Tab = typeof tabs[number]

export function Buddies() {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('All Friends')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const list = useCareer<{ players: SocialPlayer[]; blocked: CareerPlayer[] }>('/career?op=buddies&scope=circle', true)
  const found = useCareer<SocialPlayer[]>(search ? `/career?op=search&scope=circle&query=${encodeURIComponent(search)}` : null)
  const friends = list.data?.players.filter(p => p.relationship === 'accepted') ?? []
  const online = useFriendsPresence(friends)
  const compareNames = (a: SocialPlayer, b: SocialPlayer) => a.username.localeCompare(b.username) || a.id.localeCompare(b.id)
  const players = tab === 'Favourites'
    ? [...friends].sort((a, b) => (b.gamesTogether ?? 0) - (a.gamesTogether ?? 0) || compareNames(a, b)).slice(0, 10)
    : [...friends].filter(p => tab !== 'Currently Online' || online.has(p.id))
      .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || compareNames(a, b))
  const refresh = () => { list.refresh(); found.refresh() }
  const self = auth.user?.player.id.replace(/^user:/, '')
  const known = new Map(list.data?.players.map(p => [p.id, p.relationship]))
  const results = found.data?.filter(p => p.id !== self && p.relationship !== 'blocked')
    .map(p => ({ ...p, relationship: known.get(p.id) ?? p.relationship })) ?? []
  const incoming = list.data?.players.filter(p => p.relationship === 'incoming') ?? []

  function rows(items: SocialPlayer[], label: string, actions = false) {
    if (!items.length) return null
    const entries = items.map(p => <li key={p.id}>
        <a className="circle-player" href={`#/player/${p.username}`} aria-label={`View ${playerIdentity(p).label}'s profile`}>
          <span className="circle-identity">
            <PlayerIdentity player={p} avatar />
            <small className="circle-level">Level {xpProgress(p.xp, p.levelBase).level}</small>
          </span>
          <span className="ranking-score">
            <strong>{p.xp.toLocaleString()} XP</strong>
            <small>{tab === 'Favourites' ? `${p.gamesTogether ?? 0} games together` : `${p.gamesWon} wins · ${p.gamesPlayed} games`}</small>
          </span>
        </a>
        {actions && <BuddyAction id={p.id} relationship={p.relationship} circle onChange={refresh} onSuccess={setMessage} />}
      </li>)
    return actions
      ? <ul className="ranking-list circle-list" aria-label={label} tabIndex={0}>{entries}</ul>
      : <RankingList key={label} count={items.length} label={label} className="circle-list">{entries}</RankingList>
  }

  return <section className="career-section leaderboard circle-panel" aria-label="Buddies">
    <div className="leaderboard-layout circle-layout">
      <div className="career-tabs" role="group" aria-label="Your Circle tabs">
        {tabs.map(value => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setMessage('') }}>{value}</button>)}
      </div>
      <div className="leaderboard-results circle-results" aria-label={tab}>
        {(list.error || (tab === 'Friend Requests' && found.error)) && <p role="alert">{list.error || found.error} <button className="text-button" onClick={refresh}>Retry</button></p>}
        {message && <p role="status" className="circle-message">{message}</p>}
        {list.loading && !list.data && <p role="status">Loading your circle…</p>}
        {tab === 'Friend Requests' ? <>
          <form className="circle-search" onSubmit={event => { event.preventDefault(); const term = query.trim().replace(/^@/, ''); if (term.length < 2) { setMessage('Enter at least two username characters.'); return }; setMessage(''); if (term === search) found.refresh(); else setSearch(term) }}>
            <label htmlFor="circle-username">Username</label>
            <input id="circle-username" type="search" minLength={2} maxLength={64} required value={query} onChange={event => setQuery(event.target.value)} placeholder="Search usernames" autoCapitalize="none" spellCheck={false} />
            <button className="button button-primary compact-button" disabled={found.loading}>Search</button>
          </form>
          {found.loading && <p role="status">Searching players…</p>}
          <div className="circle-requests">
            {search && <section className="circle-request-group" aria-label="Search results"><h3>Search results</h3>
              {rows(results, 'Search results', true)}
              {found.data && !results.length && <p>No matching players.</p>}
            </section>}
            <section className="circle-request-group" aria-label="Incoming friend requests"><h3>Incoming friend requests</h3>
              {rows(incoming, 'Incoming friend requests', true)}
              {list.data && !incoming.length && <p>No incoming friend requests.</p>}
            </section>
          </div>
        </> : <>
          {rows(players, tab)}
          {list.data && !players.length && <p>{tab === 'Currently Online' ? 'No friends are online right now.' : tab === 'Favourites' ? 'Add friends to discover your most frequent opponents.' : 'No friends yet. Find players in Friend Requests.'}</p>}
        </>}
      </div>
    </div>
  </section>
}
