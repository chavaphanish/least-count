import { useState } from 'react'
import type { RoundScore } from '../game/engine'
import { useMobileLandscape } from './MobileOrientation'
/** Pagination changes presentation only; totals and elimination status are untouched. */
export function ResultScores({
  scores,
  round,
  winners = [],
}: {
  scores: readonly RoundScore[]
  round: number
  winners?: readonly string[]
}) {
  const mobile = useMobileLandscape(),
    [page, setPage] = useState(0)
  const pages = Math.ceil(scores.length / 4),
    current = Math.min(page, Math.max(0, pages - 1))
  return (
    <div className="result-scores">
      <table className="score-table">
        <caption>Round {round} scoring</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Hand</th>
            <th scope="col">Penalty</th>
            <th scope="col">Cumulative</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score, index) => (
            <tr
              key={score.id}
              hidden={mobile && Math.floor(index / 4) !== current}
            >
              <th scope="row">
                {score.name}
                {winners.includes(score.id) ? ' ★' : ''}
              </th>
              <td>{score.total}</td>
              <td>+{score.penalty}</td>
              <td>{score.score}</td>
              <td>{score.forfeited ? (score.eliminated ? 'Forfeited · Eliminated' : 'Forfeited') : score.eliminated ? 'Eliminated' : 'Active'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mobile && pages > 1 && (
        <nav className="item-pages" aria-label="Score pages">
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            Previous scores
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next scores
          </button>
        </nav>
      )}
    </div>
  )
}
