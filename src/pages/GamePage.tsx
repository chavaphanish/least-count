import { PlayingCard } from '../components/PlayingCard'
import { createCard } from '../game/cards'

// Display fixtures, not a deal, player-count requirement, or playable game state.
const sampleHand = [createCard('spades', 'A'), createCard('hearts', '7'), createCard('clubs', 'K'), createCard('diamonds', '3'), createCard('clubs', '9')]
const opponents = [{ name: 'Alex', initials: 'A', position: 'north' }, { name: 'Sam', initials: 'S', position: 'west' }, { name: 'Robin', initials: 'R', position: 'east' }]

export function GamePage() {
  return (
    <section className="game-page" aria-labelledby="game-title">
      <a href="#/" className="text-link back-link">← Back to the lounge</a>
      <div className="page-heading"><div><p className="eyebrow">MAKE YOURSELF AT HOME</p><h1 id="game-title">A place at the <em>table.</em></h1></div><span className="preview-pill"><span className="status-dot" /> TABLE PREVIEW</span></div>
      <p className="preview-notice">This is a visual prototype with mock players and cards. Gameplay, scoring, and online multiplayer are not implemented.</p>
      <div className="game-table" aria-label="Sample card table">
        <span className="table-watermark" aria-hidden="true">LEAST COUNT</span>
        {opponents.map(player => <div className={`opponent seat-${player.position}`} key={player.name}><div className="avatar" aria-hidden="true">{player.initials}</div><span className="player-name">{player.name} <small>Mock player</small></span><div className="opponent-cards" aria-hidden="true"><PlayingCard faceDown /><PlayingCard faceDown /><PlayingCard faceDown /></div></div>)}
        <div className="table-center"><div className="sample-pile"><PlayingCard faceDown /><span>Sample deck</span></div><div className="sample-pile"><PlayingCard card={createCard('hearts', '5')} /><span>Sample card</span></div></div>
        <div className="your-seat"><div className="hand" role="group" aria-label="Your sample hand">{sampleHand.map(card => <PlayingCard card={card} key={card.id} />)}</div><div className="your-label"><span className="status-dot" /> You <span>Sample hand · 5 cards</span></div></div>
      </div>
      <div className="table-footnote"><span>Just the atmosphere for now. The rulebook comes next.</span><a className="text-link" href="#/rules">About the rules →</a></div>
    </section>
  )
}
