import type { ReactNode } from 'react'

export function Layout({ children, page }: { children: ReactNode; page: string }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" onClick={event => {
        event.preventDefault()
        document.getElementById('main')?.focus()
      }}>Skip to content</a>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="Least Count home"><span className="brand-mark" aria-hidden="true">♠</span><span>LEAST COUNT<span className="brand-caption">THE CARD TABLE</span></span></a>
        <nav aria-label="Main navigation">
          <a href="#/rules" aria-current={page === 'rules' ? 'page' : undefined}>Rules</a>
          <a href="#/" aria-current={page === 'home' ? 'page' : undefined}>Dashboard</a>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="site-footer"><span>Good company. A fresh deck. <span className="footer-italic">A little friendly rivalry.</span></span><span className="footer-suits" aria-hidden="true">♠ <i>♥</i> ♣ <i>♦</i></span><span>Least Count <span className="footer-dot">/</span> Your card table</span></footer>
    </div>
  )
}
