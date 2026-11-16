import { SoundSettings } from '../feedback/SoundSettings'
import { useNavigationLoading } from '../components/NavigationLoading'
import { useCareer } from '../career/useCareer'
import type { CareerData } from '../career/model'
import { Buddies } from '../career/Buddies'
import { CompactForm } from '../components/CompactForm'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { playerIdentity } from '../shared/playerIdentity'
import { PlayerIdentity } from '../components/PlayerIdentity'
import { GuestNoticeDialog } from '../components/GuestNoticeDialog'
import {
  DEFAULT_ROOM_SETTINGS,
  guestMultiplayerBlocked,
  roomCode,
  roomSettings,
} from '../shared/multiplayer'
import type { RoomSettings } from '../shared/multiplayer'
export function DashboardPage() {
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
    'home' | 'create' | 'join' | 'buddies' | 'settings'
  >('home')
  const [settings, setSettings] = useState<RoomSettings>({
    ...DEFAULT_ROOM_SETTINGS,
  })
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [guestNotice, setGuestNotice] = useState(false)
  const [busy, setBusy] = useState(false)
  const go = (value: typeof mode) => {
    if (
      (value === 'create' || value === 'join') &&
      guestMultiplayerBlocked(
        player.accountType,
        auth.services.guestMultiplayerEnabled,
      )
    ) {
      setGuestNotice(true)
      return
    }
    if (value !== mode) navigation.start()
    setMode(value)
    setError('')
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (
      guestMultiplayerBlocked(
        player.accountType,
        auth.services.guestMultiplayerEnabled,
      )
    ) {
      setGuestNotice(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      const room =
        mode === 'create'
          ? await auth.services.api<{ code: string }>('/rooms', {
              method: 'POST',
              body: JSON.stringify(roomSettings(settings)),
            })
          : { code: roomCode(code) }
      if (mode === 'join')
        await auth.services.api(`/rooms/${room.code}/join`, { method: 'POST' })
      await auth.refresh()
      location.hash = `#/room/${room.code}`
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please retry.')
    } finally {
      setBusy(false)
    }
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
          <button className="text-button" onClick={() => go('home')}>
            ← Back to Lounge
          </button>
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
            <div className="account-menu">
              <h2>Settings</h2>
              <SoundSettings />
              <p>
                <PlayerIdentity player={player} compact /> ·{' '}
                {player.accountType === 'guest'
                  ? 'Guest player'
                  : 'Verified account'}
              </p>
              <a className="button button-secondary" href="#/profile">
                Profile Settings
              </a>
              <a className="button button-secondary" href="#/rules">
                How to Play
              </a>
              <button className="text-button" disabled={busy} onClick={logout}>
                {player.accountType === 'guest'
                  ? 'Leave Guest Session'
                  : 'Sign Out'}
              </button>
            </div>
          )}
        </div>
      ) : mode === 'home' ? (
        <>
          <div className="lounge-home">
            <div className="dashboard-actions" role="group" aria-label="Game options">
              <button className="button button-primary lounge-nav-button" onClick={() => go('create')}>
                Create Game Room
              </button>
              <button className="button button-primary lounge-nav-button" onClick={() => go('join')}>
                Join Game Room
              </button>
              <a className="button button-primary lounge-nav-button" href="#/game">
                Local Practice
              </a>
            </div>
            <div className="lounge-welcome">
              <div className="dashboard-heading">
                <h1>Welcome{returning ? ' back' : ''}, <em>{greetingName}</em>!</h1>
              </div>
              <div className="lounge-navigation">
                <a className="button button-primary lounge-nav-button" href="#/profile">My Profile</a>
                <button className="button button-primary lounge-nav-button" onClick={() => { location.hash = '#/leaderboards' }}>
                  Leaderboards
                </button>
                <button className="button button-primary lounge-nav-button" onClick={() => go('buddies')}>Buddies</button>
                <button className="button button-primary lounge-nav-button" onClick={() => go('settings')}>Settings</button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="room-form-panel">
          <button className="text-button" onClick={() => go('home')}>
            ← Back to Lounge
          </button>
          <h2>
            {mode === 'create'
              ? 'Your room, your card night.'
              : 'Find your table.'}
          </h2>
          <CompactForm onSubmit={submit}>
            {mode === 'create' ? (
              <>
                <label>
                  Number of players
                  <select
                    value={settings.maxPlayers}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        maxPlayers: Number(e.target.value),
                      }))
                    }
                  >
                    {Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
                      <option value={n} key={n}>
                        {n} players
                      </option>
                    ))}
                  </select>
                </label>
                <p className="field-hint">
                  {settings.maxPlayers <= 4
                    ? 'One deck + one Printed Joker'
                    : 'Two decks + two Printed Jokers'}{' '}
                  · Seven starting cards each
                </p>
                <label>
                  Elimination cutoff
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={settings.eliminationThreshold || ''}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        eliminationThreshold: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.timedGame}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        timedGame: e.target.checked,
                        turnDurationSeconds: e.target.checked ? 45 : null,
                      }))
                    }
                  />
                  Timed game · 45 seconds per turn
                </label>
                <p className="field-hint">
                  {settings.timedGame
                    ? 'The server enforces the deadline, including power-card decisions.'
                    : 'No turn countdown or timeout forfeits. Reconnection grace applies only to waiting-lobby seats.'}
                </p>
              </>
            ) : (
              <label>
                Room code
                <input
                  required
                  autoComplete="off"
                  maxLength={6}
                  placeholder="ABC234"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </label>
            )}
            <button className="button button-primary" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'create'
                  ? 'Create Room'
                  : 'Join Room'}
            </button>
          </CompactForm>
        </div>
      )}
      {error && (
        <p className="game-alert" role="alert">
          {error}
        </p>
      )}
      <button className="text-button" disabled={busy} onClick={logout}>
        {player.accountType === 'guest' ? 'Leave Guest Session' : 'Sign Out'}
      </button>
      {guestNotice && (
        <GuestNoticeDialog onDismiss={() => setGuestNotice(false)} />
      )}
    </section>
  )
}
