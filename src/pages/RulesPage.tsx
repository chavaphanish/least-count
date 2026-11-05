export function RulesPage() {
  return (
    <section className="rules-page" aria-labelledby="rules-title">
      <a className="text-link back-link" href="#/">← Back to the lounge</a>
      <div className="rules-panel"><span className="rules-suit" aria-hidden="true">♠</span><p className="eyebrow">A LITTLE PATIENCE, A BETTER GAME</p><h1 id="rules-title">The rulebook<br />is <em>on its way.</em></h1><p>Every table has its traditions. We’re waiting for the supplied rulebook before defining how Least Count is played.</p><div className="rules-note"><h2>What you can explore today</h2><p>The table preview shows sample cards and mock players. It does not deal a game, track turns, or calculate scores.</p><p>Dealing, card values, valid moves, scoring, and win conditions will be implemented after the rulebook is confirmed.</p></div><a className="button button-primary" href="#/game">Explore the table <span aria-hidden="true">→</span></a></div>
    </section>
  )
}
