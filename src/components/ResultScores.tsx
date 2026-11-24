import { PlayingCard } from './PlayingCard'
import type { CSSProperties } from 'react'
import type { GameCard } from '../game/deck'
import type { RoundResult } from '../game/engine'

export type ScorePlayer = { id: string; name: string; finalRank?: number; score: number; eliminated: boolean; forfeited?: boolean }

export function resultTitle(players: ScorePlayer[], result: RoundResult, final: boolean) {
  if (final) {
    const winner = players.find(p => !p.eliminated)
    return winner ? `${winner.name} wins the game!` : 'Final standings'
  }
  if (result.reason === 'last-player') {
    const winner = players.find(p => p.id === result.winners[0])
    if (winner) return `${winner.name} wins this round`
  }
  const caller = result.scores.find(p => p.id === result.caller)
  if (caller) return `${players.find(p => p.id === caller.id)?.name ?? caller.name} declared a least count of ${caller.total} and ${result.successful ? 'won the round!' : 'failed!'}`
  return result.reason === 'exhaustion' ? 'Draw pile exhausted' : 'One player remains this round'
}

export function ResultScores({ players, result, final, hands, quitters = [] }: {
  hands?: Record<string, GameCard[]>
  players: ScorePlayer[]; result?: RoundResult; final?: boolean; quitters?: string[]
}) {
  const ordered = final ? [...players].sort((a,b) => (a.finalRank ?? 0) - (b.finalRank ?? 0) || Number(a.eliminated) - Number(b.eliminated) || a.score - b.score) : players
  return <div className="result-scores"><table className="score-table compact-scorecard" data-hands={hands ? true : undefined} style={{'--score-rows': players.length} as CSSProperties}>
    <thead><tr>{final && <th>Rank</th>}<th>Player</th>{hands && <th className="hand-column">Hand</th>}{result && <th>Penalty</th>}<th>Score</th><th>Status</th></tr></thead>
    <tbody>{ordered.map((p,index) => {
      const row = result?.scores.find(s => s.id === p.id)
      const winner = final ? !p.eliminated : result?.winners.includes(p.id)
      return <tr key={p.id} data-winner={!!winner}>{final && <td>{index+1}</td>}<th scope="row">{p.name}{result?.caller === p.id && <small> · Least</small>}</th>
        {hands && <td>{hands[p.id]?.length ? <div className="score-hand" style={{'--hand-count': hands[p.id].length} as CSSProperties}>
          {hands[p.id].map(card => <PlayingCard key={card.id} card={card}/>)}
        </div> : hands[p.id] ? 'Empty' : '—'}</td>}
        {result && <td>{row ? `+${row.penalty}` : '—'}</td>}<td>{p.score}</td>
        <td>{quitters.includes(p.id) ? 'Quit' : p.eliminated ? 'Eliminated' : winner ? 'Winner' : p.forfeited ? 'Forfeited' : 'Active'}</td></tr>
    })}</tbody></table></div>
}
