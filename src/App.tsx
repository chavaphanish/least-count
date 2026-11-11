import { NavigationLoadingProvider, useNavigationLoading } from './components/NavigationLoading'
import { CareerProfile, GameHistoryReport } from './career/CareerProfile'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout } from './components/Layout'
import { MobileOrientation } from './components/MobileOrientation'
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
  const player = /^#\/player\/([a-z0-9_]+)$/.exec(hash)
  const history = /^#\/history\/([a-f0-9-]{36})$/.exec(hash)
  const room = /^#\/room\/([^/]+)$/.exec(hash)
  return {
    page: player
      ? 'player'
      : history
        ? 'history'
        : room
          ? 'room'
          : hash === '#/game'
            ? 'game'
            : hash === '#/rules'
              ? 'rules'
              : hash === '#/profile'
                ? 'profile'
                : 'home',
    code: room?.[1] ?? null,
    username: player?.[1],
    gameId: history?.[1],
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
  return <NavigationLoadingProvider><Application /></NavigationLoadingProvider>
}
function Application() {
  const navigation = useNavigationLoading()
  const local = useLocalGame()
  const auth = useAuth()
  const [current, setCurrent] = useState(route)
  const [startupDone, setStartupDone] = useState(() => ['game', 'rules'].includes(route().page))
  const finishStartup = useCallback(() => setStartupDone(true), [])
  useEffect(() => {
    // Offline practice/rules remain immediately accessible, including after a boot error.
    if (['game', 'rules'].includes(current.page)) setStartupDone(true)
  }, [current.page])
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
    const navigate = () => {
      const next = route()
      if (JSON.stringify(next) !== JSON.stringify(current) && next.page !== 'game') navigation.start()
      setCurrent(next)
    }
    addEventListener('hashchange', navigate)
    return () => removeEventListener('hashchange', navigate)
  }, [current, navigation.start])
  useEffect(() => {
    document.title = `YAYDU — ${current.page === 'game' ? 'Local practice' : current.page === 'room' ? 'Game room' : current.page === 'rules' ? 'How to play' : current.page === 'home' ? 'Lounge' : 'Your card table'}`
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
  else if (auth.status !== 'ready') content = null
  else if (!auth.user) content = <AccessPage invitation={invite} />
  else if (recovery) content = <RecoveryPage />
  else if (current.page === 'player')
    content = (
      <CareerProfile key={current.username} username={current.username} />
    )
  else if (current.page === 'history' && current.gameId)
    content = <GameHistoryReport key={current.gameId} id={current.gameId} />
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
          Invalid room code. <a href="#/">Return to Lounge</a>
        </p>
      )
    }
  } else content = <DashboardPage />
  const identity = auth.user?.player.id ?? null
  const previousIdentity = useRef(identity)
  useEffect(() => {
    if (startupDone && previousIdentity.current !== identity && auth.status === 'ready') navigation.start()
    previousIdentity.current = identity
  }, [identity, auth.status, startupDone, navigation.start])
  const atGame = current.page === 'game' || (current.page === 'room' && navigation.gameplay)
  useEffect(() => {
    if (atGame) { navigation.finish(); setStartupDone(true) }
  }, [atGame, navigation.finish])
  const showStartup = !atGame && !['game', 'rules'].includes(current.page) && (auth.status !== 'ready' || !startupDone)
  const showNavigation = !atGame && !showStartup && !!navigation.pending
  const covered = showStartup || showNavigation
  return (
    <MobileOrientation>
      <Layout page={current.page}>
        <div
          className="startup-content"
          hidden={covered}
          inert={covered}
          aria-hidden={covered || undefined}
        >
          {content}
        </div>
        {showNavigation && <LoadingScreen key={navigation.pending} navigation ready onComplete={navigation.finish} step={3} message="Opening your next screen…" error="" retry={navigation.finish} />}
        {showStartup && (
          <LoadingScreen
            ready={auth.status === 'ready'}
            onComplete={finishStartup}
            step={auth.step}
            message={auth.message}
            error={auth.status === 'error' ? auth.error : ''}
            retry={() => void auth.retry()}
          />
        )}
      </Layout>
    </MobileOrientation>
  )
}
