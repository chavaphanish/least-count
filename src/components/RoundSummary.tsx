import { ResultScores, resultTitle } from './ResultScores'
import { QuitGame } from './QuitGame'
import { completedHands } from '../game/engine'
import type { GameState } from '../game/engine'

export function RoundSummary({ game, nextRound, newGame, quit }: {
  game: GameState; nextRound: () => void; newGame: () => void; quit: () => void
}) {
  const final = game.phase === 'game-over'
  return <section className="round-summary" aria-labelledby="round-result">
    <div className="result-intro"><h2 id="round-result" tabIndex={-1}>{resultTitle(game.players, game.result!, final)}</h2></div>
    <ResultScores players={game.players} hands={completedHands(game)} result={game.result!} final={final}/>
    <div className="result-actions"><button className="button button-primary" onClick={final ? newGame : nextRound}>{final ? 'Return to Lobby' : `Start Round ${game.round + 1}`}</button>
    {!final && <QuitGame onQuit={quit}/>}</div></section>
}
