import type { RoundResult } from '../game/engine'

export type ScorePlayer = { id: string; name: string; finalRank?: number; score: number; eliminated: boolean; forfeited?: boolean }

export function resultTitle(players: ScorePlayer[], result: RoundResult, final: boolean) {
  if (final) {
    const winner = players.find(p => !p.eliminated)
    return winner ? `${winner.name} wins the game!` : 'Final standings'
  }
  const caller = result.scores.find(p => p.id === result.caller)
  if (caller) return `${players.find(p => p.id === caller.id)?.name ?? caller.name} declared a least count of ${caller.total} and ${result.successful ? 'won the round!' : 'failed!'}`
  return result.reason === 'exhaustion' ? 'Draw pile exhausted' : 'One player remains this round'
}

export function ResultScores({ players, result, final, quitters = [] }: {
  players: ScorePlayer[]; result?: RoundResult; final?: boolean; quitters?: string[]
}) {
  const ordered = final ? [...players].sort((a,b) => (a.finalRank ?? 0) - (b.finalRank ?? 0) || Number(a.eliminated) - Number(b.eliminated) || a.score - b.score) : players
  return <div className="result-scores"><table className="score-table compact-scorecard">
    <thead><tr>{final && <th>Rank</th>}<th>Player</th>{result && <th>Penalty</th>}<th>Score</th><th>Status</th></tr></thead>
    <tbody>{ordered.map((p,index) => {
      const row = result?.scores.find(s => s.id === p.id)
      const winner = final ? !p.eliminated : result?.winners.includes(p.id)
      return <tr key={p.id} data-winner={!!winner}>{final && <td>{index+1}</td>}<th scope="row">{p.name}{result?.caller === p.id && <small> · Least</small>}</th>
        {result && <td>{row ? `+${row.penalty}` : '—'}</td>}<td>{p.score}</td>
        <td>{quitters.includes(p.id) ? 'Quit' : p.eliminated ? 'Eliminated' : winner ? 'Winner' : p.forfeited ? 'Forfeited' : 'Active'}</td></tr>
    })}</tbody></table></div>
}
