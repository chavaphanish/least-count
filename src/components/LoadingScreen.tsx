import { useEffect, useRef, useState } from 'react'
import { DualBrand, BrandCopyright } from './DualBrand'

const MINIMUM_MS = 3000
const FINISH_MS = 350
const HOLD_MS = 120
const EXIT_MS = 180
export function LoadingScreen({
  step,
  message,
  error,
  retry,
  ready,
  onComplete,
  navigation = false,
}: {
  step: number
  message: string
  error: string
  retry: () => void
  ready: boolean
  onComplete: () => void
  navigation?: boolean
}) {
  const [attempt, setAttempt] = useState(0)
  const timing = useRef({ start: -1, last: -1, progress: 0, finish: -1, from: 0 })
  const [view, setView] = useState({ progress: 0, exiting: false })
  const [reducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (error) return
    let frame: number
    function animate(now: number) {
      const t = timing.current
      if (t.start < 0) t.start = t.last = now
      const elapsed = now - t.start
      if (ready) {
        if (t.finish < 0) {
          t.finish = Math.max(t.start + (navigation ? 800 : MINIMUM_MS), now + FINISH_MS)
          t.from = t.progress
          t.last = now
        }
        const duration = t.finish - t.last
        const fraction = duration > 0 ? Math.min(1, (now - t.last) / duration) : 1
        t.progress = t.from + (1 - t.from) * fraction
      } else {
        // Estimated motion follows real milestones smoothly, capped below completion.
        const estimate = .94 * (1 - Math.exp(-elapsed / 1600))
        const target = Math.min(.94, Math.max(estimate, Math.min(step, 3) * .24))
        t.progress += Math.max(0, target - t.progress) * (1 - Math.exp(-(now - t.last) / 500))
        t.last = now
      }
      const exiting = ready && now >= t.finish + HOLD_MS
      setView({ progress: reducedMotion && t.progress < 1 ? 0 : t.progress, exiting })
      if (ready && now >= t.finish + HOLD_MS + EXIT_MS) {
        onComplete()
        return
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [ready, step, error, onComplete, reducedMotion, navigation])

  function restart() {
    timing.current = { start: -1, last: -1, progress: 0, finish: -1, from: 0 }
    setView({ progress: 0, exiting: false })
    setAttempt(value => value + 1)
    retry()
  }
  return (
    <section
      className={`startup-screen studio-loading ${navigation ? 'navigation-loading' : ''}`}
      aria-labelledby="startup-title"
      data-ready={ready || undefined}
      data-exiting={(view.exiting && !error) || undefined}
    >
      <h1 id="startup-title" className="visually-hidden">YAYDU</h1>
      <DualBrand key={attempt} progress={view.progress} />
      <div className="brand-progress" role="progressbar" aria-label="Loading application" aria-valuetext={ready ? 'Finishing' : 'Preparing your table'}>
        <span style={{ transform: `scaleX(${view.progress})` }} />
      </div>
      <p role={error ? 'alert' : 'status'} className={error ? undefined : 'visually-hidden'}>{error || message}</p>
      <BrandCopyright />
      {error && (
        <div className="auth-actions">
          <button className="button button-primary" onClick={restart}>Retry initialization</button>
          <a className="button button-secondary" href="#/game">Play offline practice</a>
        </div>
      )}
    </section>
  )
}
