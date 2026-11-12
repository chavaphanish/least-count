import { SoundSettings } from '../feedback/SoundSettings'
import { useNavigationLoading } from '../components/NavigationLoading'
import { CareerGlance } from '../career/CareerGlance'
import { Buddies } from '../career/Buddies'
import { useMobileLandscape } from '../components/MobileOrientation'
import { CompactForm } from '../components/CompactForm'
import { Leaderboard } from '../career/Leaderboard'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { playerIdentity } from '../shared/playerIdentity'
import { PlayerIdentity } from '../components/PlayerIdentity'
import { Avatar } from '../components/Avatar'
import {
  DEFAULT_ROOM_SETTINGS,
  roomCode,
  roomSettings,
} from '../shared/multiplayer'
import type { RoomSettings } from '../shared/multiplayer'
export function DashboardPage() {
  const navigation = useNavigationLoading()
  const mobile = useMobileLandscape()
  const auth = useAuth()
  const player = auth.user!.player
  const [mode, setMode] = useState<
    'home' | 'create' | 'join' | 'ranking' | 'buddies' | 'settings'
  >('home')
  const [settings, setSettings] = useState<RoomSettings>({
    ...DEFAULT_ROOM_SETTINGS,
  })
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const go = (value: typeof mode) => {
    if (value !== mode) navigation.start()
    setMode(value)
    setError('')
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
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
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR NEXT CARD NIGHT STARTS HERE</p>
          <h1 aria-label={`Welcome, ${playerIdentity(player).label}.`}>
            Welcome, <em><PlayerIdentity player={player} compact /></em>.
          </h1>
        </div>
        <div className="player-chip">
          <Avatar player={player} />
          <span>
            <strong className="player-chip-name"><PlayerIdentity player={player} compact /></strong>
            <small>
              {player.accountType === 'guest'
                ? 'Guest player'
                : 'Registered account'}
            </small>
          </span>
        </div>
        {mobile && <CareerGlance />}
      </div>
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
      {['ranking', 'buddies', 'settings'].includes(mode) ? (
        <div className="dashboard-focused">
          <button className="text-button" onClick={() => go('home')}>
            ← Back to Lounge
          </button>
          {mode === 'ranking' ? (
            <Leaderboard />
          ) : mode === 'buddies' ? (
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
          <div className="dashboard-actions">
            <div className="dashboard-action">
              <h2>Create Game Room</h2>
              <p>Set the table. Pick your settings. Invite your friends.</p>
              <button
                className="button button-primary"
                onClick={() => go('create')}
              >
                Set the Table
              </button>
            </div>
            <div className="dashboard-action">
              <h2>Join Game Room</h2>
              <p>Have a code? Your seat is waiting.</p>
              <button
                className="button button-primary"
                onClick={() => go('join')}
              >
                Take a Seat
              </button>
            </div>
          </div>
          {mobile && (
            <div className="mobile-main-menu">
              <a
                className="button button-primary lounge-nav-button"
                href="#/profile"
              >
                My Profile
              </a>
              <button
                className="button button-primary lounge-nav-button"
                onClick={() => go('ranking')}
              >
                Leaderboards
              </button>
              <button
                className="button button-primary lounge-nav-button"
                onClick={() => go('buddies')}
              >
                Buddies
              </button>
              <button
                className="button button-primary lounge-nav-button"
                onClick={() => go('settings')}
              >
                Settings
              </button>
            </div>
          )}
          <div className="dashboard-links">
            {!mobile && <button className="text-button" onClick={() => go('settings')}>Settings</button>}
            <a className="button button-secondary" href="#/rules">
              How to Play
            </a>
            {!mobile && player.accountType === 'registered' && (
              <a
                className="button button-primary lounge-nav-button"
                href="#/profile"
              >
                My Profile
              </a>
            )}
            <a className="text-link" href="#/game">
              Local practice →
            </a>
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
                        turnDurationSeconds: e.target.checked ? 60 : null,
                      }))
                    }
                  />
                  Timed game · 60 seconds per turn
                </label>
                <p className="field-hint">
                  {settings.timedGame
                    ? 'The server enforces the deadline, including power-card decisions.'
                    : 'No turn countdown or timeout elimination. Reconnection grace applies only to waiting-lobby seats.'}
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
      {!mobile && mode === 'home' && <Leaderboard />}
    </section>
  )
}
