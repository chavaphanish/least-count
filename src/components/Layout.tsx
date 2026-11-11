import { StudioLogo } from './StudioLogo'
import type { ReactNode } from 'react'
import { useAppViewport } from './MobileOrientation'
import { useAuth } from '../auth/AuthProvider'
import { PwaStatus } from '../pwa/PwaStatus'

export function Layout({
  children,
  page,
}: {
  children: ReactNode
  page: string
}) {
  const { mobile, keyboard } = useAppViewport()
  const { user } = useAuth()
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="YAYDU home">
          <span className="brand-mark" aria-hidden="true">
            <StudioLogo />
          </span>
          <span>
            YAYDU<span className="brand-caption">The Game of Sevens</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a
            href="#/rules"
            aria-current={page === 'rules' ? 'page' : undefined}
          >
            Rules
          </a>
          <a href="#/" aria-current={page === 'home' ? 'page' : undefined}>
            Lounge
          </a>
          {mobile && user && <a href="#/profile">Profile</a>}
          {mobile && keyboard && (
            <button
              type="button"
              className="text-button keyboard-done"
              onClick={() => {
                if (document.activeElement instanceof HTMLElement)
                  document.activeElement.blur()
              }}
            >
              Done
            </button>
          )}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <PwaStatus atTable={page === 'game' || page === 'room'} />
      <footer className="site-footer">
        <span>
          Good company. A fresh deck.{' '}
          <span className="footer-italic">A little friendly rivalry.</span>
        </span>
        <span className="footer-suits" aria-hidden="true">
          ♠ <i>♥</i> ♣ <i>♦</i>
        </span>
        <span>
          YAYDU <span className="footer-dot">/</span> The Game of Sevens
        </span>
      </footer>
    </div>
  )
}
