import type { GameState } from '../game/engine'

export function RoundSummary({
  game,
  nextRound,
  newGame,
}: {
  game: GameState
  nextRound: () => void
  newGame: () => void
}) {
  const result = game.result!
  const matchOver = game.phase === 'game-over'
  const winner = game.players.find((p) => !p.eliminated)
  const caller = game.players.find((p) => p.id === result.caller)
  return (
    <section className="round-summary" aria-labelledby="round-result">
      <p className="eyebrow">
        {matchOver
          ? 'THE LAST SEAT AT THE TABLE'
          : `ROUND ${game.round} COMPLETE`}
      </p>
      <h2 id="round-result" tabIndex={-1}>
        {matchOver
          ? `${winner?.name} ${winner?.id === 'p0' ? 'win' : 'wins'} the match!`
          : result.reason === 'exhaustion'
            ? 'The draw pile is exhausted.'
            : result.successful
              ? 'Least successful! Lowest hand wins the round.'
              : 'Least failed! The declaration did not beat the table.'}
      </h2>
      <p>
        {result.reason === 'last-player'
          ? 'Only one active player remains.'
          : result.reason === 'exhaustion'
            ? 'The lowest hand totals receive zero; other players score their hand totals.'
            : `${caller?.name} declared Least. ${result.successful ? 'Zero-point ties share the round win.' : 'The caller receives 40 penalty points.'}`}{' '}
        Individual opponent cards stay concealed.
      </p>
      {!!result.scores.length && (
        <div className="score-scroll">
          <table className="score-table">
            <caption>Round {game.round} scoring</caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Hand total</th>
                <th scope="col">Penalty</th>
                <th scope="col">Cumulative</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.scores.map((score) => (
                <tr key={score.id}>
                  <th scope="row">
                    {score.name}
                    {result.winners.includes(score.id) ? ' ★' : ''}
                  </th>
                  <td>{score.total}</td>
                  <td>+{score.penalty}</td>
                  <td>{score.score}</td>
                  <td>{score.eliminated ? 'Eliminated' : 'Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="result-actions">
        {matchOver ? (
          <button className="button button-primary" onClick={newGame}>
            Set up a new game
          </button>
        ) : (
          <button className="button button-primary" onClick={nextRound}>
            Start round {game.round + 1}
          </button>
        )}
        {!matchOver && <p>Scores carry forward. No tiebreaker mode.</p>}
      </div>
    </section>
  )
}
