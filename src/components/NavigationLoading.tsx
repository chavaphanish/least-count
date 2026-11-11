import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'

const NavigationLoading = createContext({
  pending: 0,
  start: () => {},
  finish: () => {},
  gameplay: false,
  setGameplay: (_active: boolean) => {},
})

/** Presentation only: routes and their controllers remain mounted behind the cover. */
export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0)
  const [gameplay, setGameplay] = useState(false)
  const start = useCallback(() => setPending(n => n + 1 || 1), [])
  const finish = useCallback(() => setPending(0), [])
  useEffect(() => {
    if (!pending) return
    // A failed asset, cancelled animation or rapid navigation must never trap the user.
    const timeout = setTimeout(finish, 1500)
    return () => clearTimeout(timeout)
  }, [pending, finish])
  return <NavigationLoading.Provider value={{ pending, start, finish, gameplay, setGameplay }}>{children}</NavigationLoading.Provider>
}
export const useNavigationLoading = () => useContext(NavigationLoading)

export function useGameplayLoading(active: boolean) {
  const { setGameplay } = useNavigationLoading()
  useLayoutEffect(() => {
    setGameplay(active)
    return () => setGameplay(false)
  }, [active, setGameplay])
}
