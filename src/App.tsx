import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout } from './components/Layout'
import { GamePage } from './pages/GamePage'
import { RulesPage } from './pages/RulesPage'
import { AccessPage } from './pages/AccessPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProfilePage } from './pages/ProfilePage'
import { RoomPage } from './pages/RoomPage'
import { RecoveryPage } from './pages/RecoveryPage'
import { LoadingScreen } from './components/LoadingScreen'
import { useLocalGame } from './hooks/useLocalGame'
import { useAuth } from './auth/AuthProvider'
import { roomCode } from './shared/multiplayer'
function route() {
  const hash = location.hash
  const room = /^#\/room\/([^/]+)$/.exec(hash)
  return {
    page: room
      ? 'room'
      : hash === '#/game'
        ? 'game'
        : hash === '#/rules'
          ? 'rules'
          : hash === '#/profile'
            ? 'profile'
            : 'home',
    code: room?.[1] ?? null,
  }
}
function invitation() {
  try {
    const match =
      /^\/join\/([^/]+)\/?$/.exec(location.pathname) ??
      /^#\/(?:join|room)\/([^/]+)$/.exec(location.hash)
    const code = match
      ? roomCode(match[1])
      : sessionStorage.getItem('lc:invitation')
    if (code) {
      sessionStorage.setItem('lc:invitation', roomCode(code))
      return roomCode(code)
    }
  } catch {
    /* Invalid invitation can be entered again from the join form. */
  }
  return null
}
export function App() {
  const local = useLocalGame()
  const auth = useAuth()
  const [current, setCurrent] = useState(route)
  const [invite, setInvite] = useState(invitation)
  const previous = useRef(current.page)
  const clearInvite = useCallback(() => {
    setInvite(null)
    try {
      sessionStorage.removeItem('lc:invitation')
    } catch {
      /* Storage may be disabled. */
    }
  }, [])
  useEffect(() => {
    const navigate = () => setCurrent(route())
    addEventListener('hashchange', navigate)
    return () => removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    document.title = `Least Count — ${current.page === 'game' ? 'Local practice' : current.page === 'room' ? 'Game room' : current.page === 'rules' ? 'How to play' : 'Your card table'}`
    if (previous.current !== current.page) {
      document.getElementById('main')?.focus()
      scrollTo(0, 0)
      previous.current = current.page
    }
  }, [current.page])
  useEffect(() => {
    if (new URLSearchParams(location.search).get('flow') === 'recovery') return
    if (
      auth.status === 'ready' &&
      auth.user &&
      invite &&
      current.page !== 'room'
    ) {
      history.replaceState({}, '', `/#/room/${invite}`)
      setCurrent(route())
    }
  }, [auth.status, auth.user, invite, current.page])
  const recovery =
    location.pathname === '/auth/callback' &&
    new URLSearchParams(location.search).get('flow') === 'recovery'
  let content
  if (current.page === 'game') content = <GamePage local={local} />
  else if (current.page === 'rules') content = <RulesPage />
  else if (auth.status !== 'ready')
    content = (
      <LoadingScreen
        step={auth.step}
        message={auth.message}
        error={auth.status === 'error' ? auth.error : ''}
        retry={() => void auth.retry()}
      />
    )
  else if (!auth.user) content = <AccessPage invitation={invite} />
  else if (recovery) content = <RecoveryPage />
  else if (current.page === 'profile') content = <ProfilePage />
  else if (current.page === 'room' && current.code) {
    try {
      content = (
        <RoomPage
          code={roomCode(current.code)}
          onJoined={clearInvite}
          onExit={clearInvite}
        />
      )
    } catch {
      content = (
        <p role="alert">
          Invalid room code. <a href="#/">Return to dashboard</a>
        </p>
      )
    }
  } else content = <DashboardPage />
  return <Layout page={current.page}>{content}</Layout>
}
