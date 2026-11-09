import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const LandscapeContext = createContext(false)
export const useMobileLandscape = () => useContext(LandscapeContext)

function mobileDevice() {
  // Includes iPadOS's desktop user agent, without blocking touch-screen PCs.
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function portraitDisplay() {
  // The viewport also covers portrait iPad split views. Where available, the
  // physical orientation prevents a keyboard resize from revealing a portrait game.
  return matchMedia('(orientation: portrait)').matches || screen.orientation?.type.startsWith('portrait') === true
}

/** Presentation only: children stay mounted and all game/session clocks keep running. */
export function MobileOrientation({ children }: { children: ReactNode }) {
  const [mobile] = useState(mobileDevice)
  const [portrait, setPortrait] = useState(portraitDisplay)
  const message = useRef<HTMLDivElement>(null)
  const blocked = mobile && portrait
  useEffect(() => {
    const query = matchMedia('(orientation: portrait)')
    const orientation = screen.orientation
    const update = () => setPortrait(portraitDisplay())
    query.addEventListener('change', update)
    orientation?.addEventListener?.('change', update)
    window.addEventListener('orientationchange', update)
    update()
    return () => {
      query.removeEventListener('change', update)
      orientation?.removeEventListener?.('change', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  useEffect(() => {
    if (!blocked) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    message.current?.focus({ preventScroll: true })
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [blocked])
  return (
    <div className="mobile-shell" data-mobile-device={mobile || undefined} data-portrait={blocked || undefined}>
      <div className="orientation-content" inert={blocked} aria-hidden={blocked || undefined}>
        <LandscapeContext.Provider value={mobile && !portrait}>{children}</LandscapeContext.Provider>
      </div>
      {blocked && (
        <div className="rotation-screen" role="dialog" aria-modal="true" aria-labelledby="rotation-title" aria-describedby="rotation-description" tabIndex={-1} ref={message}>
          <svg className="rotation-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <rect x="32" y="20" width="36" height="60" rx="6" />
            <path d="M44 72h12M15 40a36 36 0 0 1 58-22m0 0V6m0 12H61M85 60a36 36 0 0 1-58 22m0 0v12m0-12h12" />
          </svg>
          <h1 id="rotation-title">Rotate Your Phone</h1>
          <p id="rotation-description">Least Count is designed to be played in landscape mode.</p>
          <p className="rotation-detail">Turn your phone sideways to return to your table. Live turns and timers continue.</p>
        </div>
      )}
    </div>
  )
}
