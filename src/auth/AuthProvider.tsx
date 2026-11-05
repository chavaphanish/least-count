import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { initialize, ServiceError, Services } from './services'
import type { SessionUser } from '../shared/multiplayer'

type AuthState = {
  user: SessionUser | null
  room: { id: string; code: string } | null
  status: 'loading' | 'ready' | 'error'
  step: number
  message: string
  error: string
}
const initial: AuthState = {
  user: null,
  room: null,
  status: 'loading',
  step: 0,
  message: 'Loading application…',
  error: '',
}
function useAuthentication() {
  const services = useRef(new Services()).current
  const [state, setState] = useState<AuthState>(initial)
  const generation = useRef(0)
  const sessionRevision = useRef(0)
  const activeBoot = useRef<AbortController | null>(null)
  const [configured, setConfigured] = useState(false)
  const refresh = useCallback(async () => {
    const revision = ++sessionRevision.current
    const session = await services.session()
    if (revision !== sessionRevision.current) return session
    setState((s) => ({ ...s, ...session, status: 'ready', error: '' }))
    return session
  }, [services])
  const boot = useCallback(async () => {
    activeBoot.current?.abort()
    const attempt = ++generation.current
    setState({ ...initial })
    const controller = new AbortController()
    activeBoot.current = controller
    const timer = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const aborted = new Promise<never>((_, reject) =>
        controller.signal.addEventListener(
          'abort',
          () =>
            reject(new ServiceError('Initialization timed out. Please retry.')),
          { once: true },
        ),
      )
      const result = await Promise.race([
        initialize(
          {
            config: (signal) => services.api('/config', {}, signal),
            configure: (config) => {
              services.configure(config)
              setConfigured(!!config.supabase)
            },
            restore: async () => {
              if (services.provider) {
                const { error } = await services.provider.auth.getSession()
                if (error) throw error
              }
            },
            session: (signal) => services.session(signal),
          },
          (step, message) => {
            if (generation.current === attempt)
              setState((s) => ({ ...s, step, message }))
          },
          controller.signal,
        ),
        aborted,
      ])
      if (generation.current === attempt)
        setState({
          user: result.user,
          room: result.room,
          status: 'ready',
          step: 4,
          message: 'Ready to play!',
          error:
            !result.user &&
            (new URLSearchParams(location.search).has('error') ||
              new URLSearchParams(location.hash.slice(1)).has('error'))
              ? 'Sign-in was cancelled or could not complete. Please try again.'
              : !result.user &&
                  new URLSearchParams(location.search).get('flow') ===
                    'recovery'
                ? 'This reset link is invalid or expired. Request a new reset link.'
                : '',
        })
    } catch (error) {
      if (generation.current === attempt)
        setState((s) => ({
          ...s,
          status:
            error instanceof ServiceError &&
            (error.code === 'EMAIL_UNVERIFIED' || error.status === 401)
              ? 'ready'
              : 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Initialization failed. Please retry.',
        }))
    } finally {
      window.clearTimeout(timer)
    }
  }, [services])
  useEffect(() => {
    void boot()
    return () => {
      generation.current++
      sessionRevision.current++
      activeBoot.current?.abort()
    }
  }, [boot])
  useEffect(() => {
    if (!configured || !services.provider) return
    const { data } = services.provider.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return
      // Run outside Supabase's auth callback lock.
      window.setTimeout(() => {
        void refresh().catch((error) =>
          setState((s) => ({
            ...s,
            user: null,
            room: null,
            status: 'ready',
            error: error instanceof Error ? error.message : 'Sign in again.',
          })),
        )
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [configured, services, refresh])
  const guest = async (name: string) => {
    if (services.provider)
      await services.provider.auth.signOut({ scope: 'local' })
    await services.api('/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName: name }),
    })
    await refresh()
  }
  const signOut = async () => {
    await services.api('/logout', { method: 'POST' })
    if (services.provider) {
      const { error } = await services.provider.auth.signOut({ scope: 'local' })
      if (error) throw error
    }
    sessionRevision.current++
    setState((s) => ({
      ...s,
      user: null,
      room: null,
      error: '',
      status: 'ready',
    }))
  }
  return {
    ...state,
    services,
    configured,
    refresh,
    retry: boot,
    guest,
    signOut,
  }
}
export type AuthContextValue = ReturnType<typeof useAuthentication>
const Context = createContext<AuthContextValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthentication()
  return <Context.Provider value={auth}>{children}</Context.Provider>
}
export function useAuth() {
  const auth = useContext(Context)
  if (!auth) throw new Error('AuthProvider is required.')
  return auth
}
