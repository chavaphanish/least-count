import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
export function useCareer<T>(path: string | null, poll = false) {
  const { services } = useAuth()
  const [saved, setSaved] = useState<{ path: string; data: T } | null>(null)
  const data = saved?.path === path ? saved.data : null
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((n) => n + 1), [])
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        setLoading(false)
        setError('Player services timed out. Please retry.')
        controller.abort()
      }
    }, 15_000)
    services
      .api<T>(path, {}, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSaved({ path, data: value })
          setError('')
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load player data.',
          )
      })
      .finally(() => {
        clearTimeout(timer)
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [services, path, version])
  useEffect(() => {
    if (!poll || !path) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30_000)
    const focus = () => refresh()
    addEventListener('focus', focus)
    return () => {
      clearInterval(timer)
      removeEventListener('focus', focus)
    }
  }, [path, poll, refresh])
  return { data, error, loading, refresh }
}
