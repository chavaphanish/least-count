import { HeaderBrand } from './HeaderBrand'
import type { ReactNode } from 'react'
import { useAppViewport } from './MobileOrientation'
import { useAuth } from '../auth/AuthProvider'
import { HeaderProfile } from './HeaderProfile'
import { TableOverlay } from './TableOverlay'
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
    <div className="app-shell" data-access={!user && page !== 'rules' || undefined}>
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
      <header className="site-header" data-authenticated={user ? true : undefined}>
        <HeaderBrand signedOut={!user} />
        {user && <HeaderProfile />}
        <nav aria-label="Main navigation">
          <a
            href="#/rules"
            aria-current={page === 'rules' ? 'page' : undefined}
          >
            Rules
          </a>
          {user && <>
          <a href="#/" aria-current={page === 'home' ? 'page' : undefined}>
            Lounge
          </a>
          <a className="header-icon" href="#/leaderboards" aria-label="Leaderboards" title="Leaderboards" aria-current={page === 'leaderboards' ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 4h8v5a4 4 0 0 1-8 0ZM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-9 0v-3h10v3" />
            </svg>
          </a>
          <a className="header-icon" href="#/buddies" aria-label="Buddies" title="Buddies" aria-current={page === 'buddies' ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-3-5.2" />
            </svg>
          </a>
          <TableOverlay label="Mailbox" triggerClass="header-icon" trigger={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 6 9 7 9-7" />
            </svg>
          }>
            <p>Under Construction.</p>
          </TableOverlay>
          <a className="header-icon" href="#/settings" aria-label="Settings" title="Settings" aria-current={page === 'settings' ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 3h5l.5 2.2 2 1.1 2.1-.6 2.4 4.2-1.6 1.6v2.3l1.6 1.6-2.4 4.2-2.1-.6-2 1.1-.5 2.2h-5L9 20.1 7 19l-2.1.6-2.4-4.2 1.6-1.6v-2.3L2.5 9.9l2.4-4.2 2.1.6 2-1.1Z" />
              <circle cx="12" cy="12.6" r="3" />
            </svg>
          </a>
          </>}
          {user && mobile && keyboard && (
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
