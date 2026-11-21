import { useLayoutEffect } from 'react'
import { QuitGame } from './QuitGame'
import { useMobileLandscape } from './MobileOrientation'
import { TableOverlay } from './TableOverlay'
import { ResultScores } from './ResultScores'
import { TurnTimer } from './TurnTimer'
import type { GameCard } from '../game/deck'

export function MobileGameBar({
  round,
  activeName,
  seconds,
  joker,
  penalty,
  players,
  onQuit,
}: {
  round: number
  activeName: string
  seconds: number | null
  joker: Pick<GameCard, 'rank' | 'suit'>
  penalty: number
  players: { id: string; name: string; score: number; eliminated: boolean; forfeited?: boolean }[]
  onQuit: () => void
}) {
  const mobile = useMobileLandscape()
  useLayoutEffect(() => {
    if (mobile) window.scrollTo(0, 0)
  }, [mobile])
  const scorecard = <TableOverlay label="Scorecard" trigger="☰"><ResultScores players={players}/><QuitGame onQuit={onQuit}/></TableOverlay>
  if (!mobile) return <div className="desktop-scorecard">{scorecard}</div>
  const suits: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }
  return (
    <header className="mobile-game-bar" aria-label="Game information">
      <strong className="mobile-round">Round {round}</strong>
      <span className="mobile-active-player" title={`${activeName}'s turn`}>
        <i aria-hidden="true" />
        {activeName}
      </span>
      <TurnTimer seconds={seconds} name={activeName} />
      <span className="mobile-joker" aria-label={`Round Joker: ${joker.rank}`}>
        <small>Round Joker</small>
        <strong>
          {joker.rank}
          {suits[joker.suit] ?? ''}
        </strong>
      </span>
      {!!penalty && (
        <strong className="mobile-penalty" role="status">
          7 · +{penalty}
        </strong>
      )}
      {scorecard}
    </header>
  )
}
