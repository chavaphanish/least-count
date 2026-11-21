import { DualBrand, BrandCopyright } from './DualBrand'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
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
  const visual = window.visualViewport
  // iOS can briefly report the previous orientation's visual viewport at launch.
  const usable = visual && visual.width > 0 && visual.height > 0 &&
    (visual.scale !== 1 || Math.abs(visual.width - innerWidth) < 80)
  return {
    width: Math.round(usable ? Math.min(visual.width, innerWidth) : innerWidth),
    height: Math.round(usable ? Math.min(visual.height, innerHeight) : innerHeight),
  }
}
export function MobileOrientation({ children }: { children: ReactNode }) {
  const [mobile] = useState(mobileDevice)
  const [portrait, setPortrait] = useState(
    () => matchMedia('(orientation: portrait)').matches,
  )
  const guard = useRef<HTMLDialogElement>(null)
  const blocked = mobile && portrait
  useEffect(() => {
    const query = matchMedia('(orientation: portrait)')
    const update = () => setPortrait(query.matches)
    query.addEventListener('change', update)
    update()
    return () => query.removeEventListener('change', update)
  }, [])
  useLayoutEffect(() => {
    const dialog = guard.current!
    if (blocked && !dialog.open) dialog.showModal()
    else if (!blocked && dialog.open) dialog.close()
  }, [blocked])
  const [viewport, setViewport] = useState<Viewport>(() => ({
    mobile,
    ...dimensions(),
    keyboard: false,
  }))
  const baseline = useRef(dimensions())
  const requested = useRef(false)
  const keyboardVisible = useRef(false)
  useLayoutEffect(() => {
    let frame = 0
    let settling: ReturnType<typeof setTimeout>[] = []
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
      setViewport(previous => previous.width === size.width &&
        previous.height === size.height && previous.keyboard === keyboard
        ? previous : { mobile, ...size, keyboard })
      if (mobile && (window.scrollX || window.scrollY)) window.scrollTo(0, 0)
    }
    const cancelSettling = () => {
      cancelAnimationFrame(frame)
      settling.forEach(clearTimeout)
      settling = []
    }
    const stabilize = () => {
      cancelSettling()
      update()
      if (!mobile) return
      // Safari's standalone launch/rotation measurements may settle without another event.
      frame = requestAnimationFrame(update)
      settling = [100, 250, 500, 1000, 1500].map(delay => setTimeout(update, delay))
    }
    const resume = () => { if (document.visibilityState === 'visible') stabilize() }
    window.visualViewport?.addEventListener('resize', stabilize)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('resize', stabilize)
    window.addEventListener('orientationchange', stabilize)
    screen.orientation?.addEventListener('change', stabilize)
    window.addEventListener('pageshow', stabilize)
    document.addEventListener('visibilitychange', resume)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    stabilize()
    return () => {
      cancelSettling()
      window.visualViewport?.removeEventListener('resize', stabilize)
      window.visualViewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', stabilize)
      window.removeEventListener('orientationchange', stabilize)
      screen.orientation?.removeEventListener('change', stabilize)
      window.removeEventListener('pageshow', stabilize)
      document.removeEventListener('visibilitychange', resume)
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
    // One supported request, no resize loop, fullscreen coercion.
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
        <div
          className="orientation-content"
          hidden={blocked}
          inert={blocked}
          aria-hidden={blocked || undefined}
        >
          {children}
        </div>
        <dialog
          ref={guard}
          className="orientation-guard"
          aria-labelledby="orientation-title"
          aria-describedby="orientation-description"
          onCancel={(event) => event.preventDefault()}
        >
          <DualBrand />
          <svg
            viewBox="0 0 80 80"
            width="80"
            height="80"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <rect
              x="24"
              y="13"
              width="32"
              height="54"
              rx="5"
              transform="rotate(35 40 40)"
            />
            <path d="M10 35a31 31 0 0 1 49-20m-1-10 2 11-11 1M70 45a31 31 0 0 1-49 20m1 10-2-11 11-1" />
          </svg>
          <h1 id="orientation-title">Rotate Your Phone</h1>
          <p id="orientation-description">
            YAYDU is designed to be played in landscape mode.
          </p>
          <BrandCopyright />
        </dialog>
      </div>
    </ViewportContext.Provider>
  )
}
