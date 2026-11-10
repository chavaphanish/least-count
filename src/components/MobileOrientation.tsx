import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'

type Viewport = {
  mobile: boolean
  width: number
  height: number
  keyboard: boolean
}
const ViewportContext = createContext<Viewport>({
  mobile: false,
  width: 0,
  height: 0,
  keyboard: false,
})
export const useAppViewport = () => useContext(ViewportContext)
// Existing presentation consumers share this context in either physical orientation.
export const useMobileLandscape = () => useAppViewport().mobile
function mobileDevice() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}
function dimensions() {
  return {
    width: Math.round(window.visualViewport?.width ?? innerWidth),
    height: Math.round(window.visualViewport?.height ?? innerHeight),
  }
}
export function MobileOrientation({ children }: { children: ReactNode }) {
  const [mobile] = useState(mobileDevice)
  const [viewport, setViewport] = useState<Viewport>(() => ({
    mobile,
    ...dimensions(),
    keyboard: false,
  }))
  const baseline = useRef(dimensions())
  const requested = useRef(false)
  const keyboardVisible = useRef(false)
  useEffect(() => {
    const update = () => {
      const size = dimensions()
      const input =
        document.activeElement?.matches('input:not([type=file]),textarea') ??
        false
      if (Math.abs(baseline.current.width - size.width) > 80)
        baseline.current = size
      else
        baseline.current = {
          width: size.width,
          height: Math.max(size.height, baseline.current.height),
        }
      const keyboard =
        baseline.current.height - size.height > 70 &&
        (input ||
          !!document.querySelector('form:focus-within') ||
          keyboardVisible.current)
      keyboardVisible.current = keyboard
      setViewport({ mobile, ...size, keyboard })
      if (mobile) window.scrollTo(0, 0)
    }
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    update()
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [mobile])
  useEffect(() => {
    const installed =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>
    }
    if (
      !mobile ||
      !installed ||
      Capacitor.isNativePlatform() ||
      requested.current ||
      !orientation?.lock
    )
      return
    requested.current = true
    // One supported request, no resize loop, fullscreen coercion or orientation warning.
    void orientation.lock('landscape').catch(() => {})
  }, [mobile])
  return (
    <ViewportContext.Provider value={viewport}>
      <div
        className="mobile-shell"
        data-mobile-device={mobile || undefined}
        data-keyboard={(mobile && viewport.keyboard) || undefined}
        style={
          {
            '--app-width': `${viewport.width}px`,
            '--app-height': `${viewport.height}px`,
          } as CSSProperties
        }
      >
        <div className="orientation-content">{children}</div>
      </div>
    </ViewportContext.Provider>
  )
}
