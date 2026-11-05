import { PlayingCard } from '../components/PlayingCard'
import { createCard } from '../game/cards'

export function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> YOUR NEXT CARD NIGHT STARTS HERE</p>
          <h1 id="home-title">Good friends.<br />Great cards.<br /><em>Least Count.</em></h1>
          <p className="hero-description">A new seat at your favorite card table.<br className="desktop-break" /> Made for friendly rivalries and just-one-more-round nights.</p>
          <div className="hero-actions"><a className="button button-primary" href="#/game">Play Game <span aria-hidden="true">→</span></a><a className="button button-secondary" href="#/rules">Rules <span aria-hidden="true">→</span></a></div>
          <p className="action-note"><span className="status-dot" /> Play locally with simulated opponents · No sign-up needed</p>
        </div>
        <div className="hero-art" aria-label="An illustrated green card table with a fan of playing cards" role="img">
          <div className="table-orbit orbit-outer" /><div className="table-orbit orbit-inner" />
          <span className="table-label top-label">A SEAT IS WAITING FOR YOU</span>
          <div className="card-fan" aria-hidden="true">
            <PlayingCard card={createCard('clubs', 'K')} className="fan-one" />
            <PlayingCard card={createCard('diamonds', '7')} className="fan-two" />
            <PlayingCard card={createCard('spades', 'A')} className="fan-three" />
            <PlayingCard card={createCard('hearts', 'Q')} className="fan-four" />
          </div>
          <span className="floating-suit suit-one" aria-hidden="true">♣</span><span className="floating-suit suit-two" aria-hidden="true">♦</span>
          <div className="table-seal" aria-hidden="true"><span>EST.</span><strong>♠</strong><span>2026</span></div>
          <span className="table-label bottom-label">SHUFFLE. SETTLE IN. STAY A WHILE.</span>
        </div>
      </section>
      <section className="welcome-section" aria-labelledby="welcome-title">
        <div className="section-heading"><h2 id="welcome-title">The familiar table. <em>A fresh beginning.</em></h2><span>BUILT FOR THE BROWSER</span></div>
        <div className="feature-grid">
          <article className="feature"><span className="feature-icon" aria-hidden="true">♠</span><div><h3>Make your next move</h3><p>A full local match: seven cards, a ticking clock, and a little friendly rivalry.</p><a className="text-link" href="#/game">Play local practice <span aria-hidden="true">→</span></a></div></article>
          <article className="feature"><span className="feature-icon" aria-hidden="true">♧</span><div><h3>Your table, anywhere</h3><p>A little room for card night, on your desktop, tablet, or phone.</p><span className="feature-caption">NO DOWNLOAD REQUIRED</span></div></article>
          <article className="feature future-feature"><span className="feature-icon" aria-hidden="true">♢</span><div><h3>Better with friends <span className="coming-soon">COMING LATER</span></h3><p>Online multiplayer and private rooms are on the horizon.</p><span className="feature-caption">MULTIPLAYER IS NOT AVAILABLE YET</span></div></article>
        </div>
      </section>
    </>
  )
}
