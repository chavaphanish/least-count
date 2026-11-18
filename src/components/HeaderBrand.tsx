import { StudioLogo } from './StudioLogo'

export function HeaderBrand({ signedOut }: { signedOut: boolean }) {
  return <a className={`brand nav-brand${signedOut ? ' signed-out-brand' : ''}`} href="#/" aria-label="YAYDU home">
    <span className="brand-mark" aria-hidden="true"><StudioLogo /></span>
    <span className="header-brand-copy">
      <strong className="header-wordmark">YAYDU</strong>{' '}
      <span className="header-brand-dot" aria-hidden="true">·</span>{' '}
      <span className="header-brand-tagline">The Game of Sevens</span>
    </span>
  </a>
}
