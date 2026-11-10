import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { usernameError } from '../shared/identity'
export function useUsername(value: string) {
  const { services } = useAuth()
  const [result, setResult] = useState<{
    value: string
    available?: boolean
    error?: string
  } | null>(null)
  const [version, setVersion] = useState(0)
  const format = usernameError(value),
    candidate = value.toLowerCase()
  useEffect(() => {
    setResult(null)
    if (format) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      services
        .api<{ available: boolean }>(
          `/username?username=${encodeURIComponent(candidate)}`,
          {},
          controller.signal,
        )
        .then((data) => {
          if (!controller.signal.aborted)
            setResult({ value: candidate, available: data.available })
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResult({
              value: candidate,
              error:
                error instanceof Error
                  ? error.message
                  : 'Could not check username. Please retry.',
            })
        })
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [candidate, format, services, version])
  return {
    refresh: () => {
      setResult(null)
      setVersion((v) => v + 1)
    },
    available:
      !format && result?.value === candidate && result.available === true,
    message:
      format ||
      (result?.value !== candidate
        ? 'Checking username…'
        : result.error ||
          (result.available
            ? 'Username available.'
            : 'Username already taken.')),
  }
}
