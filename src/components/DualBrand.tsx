import { useState } from 'react'
import { StudioLogo } from './StudioLogo'
import type { ReactNode } from 'react'

/** Clip only the transparent artwork layers; all three fills share one progress value. */
function BrandFill({ label, progress, left, right, children }: {
  label: string; progress?: number; left: number; right: number; children: ReactNode
}) {
  const complete = progress === undefined
  const edge = complete || progress <= 0 ? 0 : progress >= 1 ? 100 : left + (right - left) * progress
  return <div className="brand-fill" role="img" aria-label={label} data-fill={progress}>
    <span className={complete ? 'brand-static' : 'brand-unfilled'} aria-hidden="true" style={complete ? undefined : { clipPath: `inset(0 0 0 ${edge}%)` }}>{children}</span>
    {!complete && <span className="brand-filled" aria-hidden="true" style={{ clipPath: `inset(0 ${100 - edge}% 0 0)` }}>{children}</span>}
  </div>
}

export function DualBrand({ progress }: { progress?: number }) {
  const [yayduFailed, setYayduFailed] = useState(false)
  const [studioFailed, setStudioFailed] = useState(false)
  return <div className="dual-brand" data-mode={progress === undefined ? 'static' : 'loading'}>
    <div className="dual-yaydu">
      <div className="loading-logo" data-fill={progress}>
        <BrandFill label="YAYDU" progress={progress} left={13.3} right={87.8}>
          {yayduFailed ? <span className="studio-logo-fallback">YAYDU</span> : <StudioLogo onError={() => setYayduFailed(true)} />}
        </BrandFill>
      </div>
      <BrandFill label="YAYDU wordmark" progress={progress} left={0} right={100}>
        <span className="yaydu-wordmark">YAYDU</span>
      </BrandFill>
      <p className="brand-tagline">The Game of Sevens</p>
    </div>
    <span className="brand-separator" aria-hidden="true" />
    <div className="dual-studio">
      <p className="powered-by">Powered by</p>
      <BrandFill label="Chavium Games" progress={progress} left={176 / 1536 * 100} right={1360 / 1536 * 100}>
        {studioFailed ? <span className="studio-logo-fallback">Chavium Games</span> : <img className="chavium-logo" src="/branding/chavium-games-gold.png" alt="" width="1536" height="1024" onError={() => setStudioFailed(true)} />}
      </BrandFill>
    </div>
  </div>
}

export function BrandCopyright() {
  return <small className="brand-copyright">© 2026 Chavium Games Pvt. Ltd. | ver. {__APP_VERSION__}</small>
}
