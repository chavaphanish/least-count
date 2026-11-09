import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState } from 'react'

/** Updates never reload a live game, including other tabs controlled by this worker. */
export function PwaStatus({ atTable }: { atTable: boolean }) {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [updating, setUpdating] = useState(false)
  const reloadRequested = useRef(false)
  useEffect(() => {
    const network = () => setOffline(!navigator.onLine)
    addEventListener('online', network)
    addEventListener('offline', network)
    return () => {
      removeEventListener('online', network)
      removeEventListener('offline', network)
    }
  }, [])
  useEffect(() => {
    if (!import.meta.env.PROD || Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return
    let stopped = false
    let registration: ServiceWorkerRegistration | undefined
    const cleanups: (() => void)[] = []
    const check = () => {
      if (!document.hidden && navigator.onLine) void registration?.update().catch(() => {})
    }
    const controller = () => {
      if (reloadRequested.current) location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', controller)
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(value => {
      if (stopped) return
      registration = value
      const ready = () => {
        if (!stopped && value.waiting && value.active) setWaiting(value.waiting)
      }
      const installing = () => {
        const worker = value.installing
        if (!worker) return
        worker.addEventListener('statechange', ready)
        cleanups.push(() => worker.removeEventListener('statechange', ready))
      }
      value.addEventListener('updatefound', installing)
      cleanups.push(() => value.removeEventListener('updatefound', installing))
      installing()
      ready()
    }).catch(() => { /* Web play still works if installation is unavailable. */ })
    addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 60_000)
    return () => {
      stopped = true
      cleanups.forEach(cleanup => cleanup())
      window.clearInterval(timer)
      removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
      navigator.serviceWorker.removeEventListener('controllerchange', controller)
    }
  }, [])
  if (offline) return <aside className="pwa-status" role="status">You’re offline. Online games need a connection; server timers continue. Reconnecting when available.</aside>
  if (!waiting || atTable) return null
  return (
    <aside className="pwa-status" role="status">
      <span>A new Least Count version is ready. Reload when you’ve finished playing.</span>
      <button className="text-button" disabled={updating} onClick={() => {
        reloadRequested.current = true
        setUpdating(true)
        waiting.postMessage({ type: 'ACTIVATE_UPDATE' })
      }}>{updating ? 'Updating…' : 'Update and reload'}</button>
    </aside>
  )
}
