import { TableOverlay } from '../components/TableOverlay'
import { SettingsPanel } from '../components/SettingsPanel'
import { useNavigationLoading } from '../components/NavigationLoading'
import { useCareer } from '../career/useCareer'
import type { CareerData } from '../career/model'
import { Buddies } from '../career/Buddies'
import { CompactForm } from '../components/CompactForm'
import { useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { playerIdentity } from '../shared/playerIdentity'
import { GuestNoticeDialog } from '../components/GuestNoticeDialog'
import {
  DEFAULT_ROOM_SETTINGS,
  guestMultiplayerBlocked,
  roomCode,
} from '../shared/multiplayer'
export function DashboardPage({ initialMode = 'home' }: { initialMode?: 'home' | 'settings' | 'buddies' }) {
  const navigation = useNavigationLoading()
  const auth = useAuth()
  const player = auth.user!.player
  const { data: career } = useCareer<CareerData>(
    player.accountType === 'registered' ? '/career?op=profile' : null,
  )
  // Activity timestamps also change on first-session reads; prior games are explicit evidence.
  const returning = (career?.profile.gamesPlayed ?? 0) > 0 || (career?.statistics?.gamesStarted ?? 0) > 0
  const greetingName = returning ? player.firstName || playerIdentity(player).primary : playerIdentity(player).primary
  const [mode, setMode] = useState<
    'home' | 'join' | 'buddies' | 'settings'
  >(initialMode)
  const creating = useRef(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [guestNotice, setGuestNotice] = useState(false)
  const [busy, setBusy] = useState(false)
  const go = (value: typeof mode) => {
    if (
      value === 'join' &&
      guestMultiplayerBlocked(
        player.accountType,
        auth.services.guestMultiplayerEnabled,
      )
    ) {
      setGuestNotice(true)
      return
    }
    if (value === 'home' && initialMode !== 'home') location.hash = '#/'
    if (value !== mode) navigation.start()
    setMode(value)
    setError('')
  }
  async function hostGame() {
    if (creating.current) return
    if (guestMultiplayerBlocked(player.accountType, auth.services.guestMultiplayerEnabled)) {
      setGuestNotice(true)
      return
    }
    creating.current = true
    setBusy(true); setError('')
    try {
      const room = await auth.services.api<{ code: string }>('/rooms', {
        method: 'POST', body: JSON.stringify(DEFAULT_ROOM_SETTINGS),
      })
      location.hash = `#/room/${room.code}`
      // Membership refresh must not delay entering the newly created lobby.
      void auth.refresh().catch(() => {})
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not host a game. Please retry.')
    } finally {
      creating.current = false
      setBusy(false)
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (guestMultiplayerBlocked(player.accountType, auth.services.guestMultiplayerEnabled)) {
      setGuestNotice(true)
      return
    }
    setBusy(true); setError('')
    try {
      const codeToJoin = roomCode(code)
      await auth.services.api(`/rooms/${codeToJoin}/join`, { method: 'POST' })
      await auth.refresh()
      location.hash = `#/room/${codeToJoin}`
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please retry.')
    } finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try {
      await auth.signOut()
      location.hash = '#/'
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign out failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="dashboard-page" data-mode={mode}>
      {(auth.room || auth.user?.profile?.needsCompletion) && (
        <div className="invitation-banner">
          {auth.user?.profile?.needsCompletion && (
            <>
              Complete your player identity.{' '}
              <a className="text-link" href="#/profile">
                Update profile →
              </a>{' '}
            </>
          )}
          {auth.room && (
            <>
              You have a seat in <strong>{auth.room.code}</strong>.{' '}
              <a className="text-link" href={`#/room/${auth.room.code}`}>
                Return to your room →
              </a>
            </>
          )}
        </div>
      )}
      {['buddies', 'settings'].includes(mode) ? (
        <div className="dashboard-focused">
          {mode === 'buddies' ? (
            player.accountType === 'registered' ? (
              <Buddies />
            ) : (
              <p>
                Verified accounts can manage buddies.{' '}
                <a href="#/profile">Account options</a>
              </p>
            )
          ) : (
            <SettingsPanel busy={busy} logout={logout} />
          )}
        </div>
      ) : mode === 'home' ? (
        <>
          <div className="lounge-home">
            <div className="lounge-welcome" data-long-name={greetingName.length > 40 || undefined}>
              <div className="dashboard-heading">
                <h1><span className="lounge-greeting">Welcome{returning ? ' back' : ''}, </span><em>{greetingName}!</em></h1>
              </div>
            </div>
            <div className="dashboard-actions" role="group" aria-label="Game options">
              <button className="button button-primary lounge-nav-button lounge-action-featured" disabled={busy} onClick={() => void hostGame()}>
                <svg className="lounge-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
                {busy ? 'Creating room…' : 'Host a Game'}
              </button>
              <button className="button button-primary lounge-nav-button" onClick={() => go('join')}>
                <svg className="lounge-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M3 12h12m-4-4 4 4-4 4" /></svg>
                Join Game Room
              </button>
              <a className="button button-primary lounge-nav-button" href="#/game">
                <svg className="lounge-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="3" width="12" height="17" rx="2" /><path d="m5 6-2 1 3 14a2 2 0 0 0 2 1l6-1M14 8l3 4-3 4-3-4Z" /></svg>
                Local Practice
              </a>
              <TableOverlay label="Tutorial" dismissLabel="OK" triggerClass="button button-primary lounge-nav-button" trigger={<>
                <svg className="lounge-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z" /></svg>
                Tutorial
              </>}>
                <p>Under construction</p>
              </TableOverlay>
            </div>
          </div>
        </>
      ) : (
        <div className="room-form-panel">
          <button className="text-button" onClick={() => go('home')}>
            ← Back to Lounge
          </button>
          <h2>Find your table.</h2>
          <CompactForm onSubmit={submit}>
            <label>
              Room code
              <input required autoComplete="off" maxLength={6} placeholder="ABC234"
                value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
            </label>
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Join Room'}
            </button>
          </CompactForm>
        </div>
      )}
      {error && (
        <p className="game-alert" role="alert">
          {error}
        </p>
      )}
      {guestNotice && (
        <GuestNoticeDialog onDismiss={() => setGuestNotice(false)} />
      )}
    </section>
  )
}
