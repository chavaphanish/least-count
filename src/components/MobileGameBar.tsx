import type { ReactNode } from 'react'
import type { Phase } from '../game/engine'
import { useLayoutEffect } from 'react'
import { QuitGame } from './QuitGame'
import { useMobileLandscape } from './MobileOrientation'
import { TableOverlay } from './TableOverlay'
import { ResultScores } from './ResultScores'
import { TurnTimer } from './TurnTimer'
import type { GameCard } from '../game/deck'

export function MobileGameBar({
  round,
  activeName, instruction, children,
  seconds,
  joker,
  penalty,
  players,
  onQuit,
}: {
  round: number
  instruction: string
  children?: ReactNode
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
  const scorecard = <TableOverlay label="Scorecard" trigger="☰"><ResultScores players={players}/>{!mobile && children}<QuitGame onQuit={onQuit}/></TableOverlay>
  const suits: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }
  return (
    <header className="mobile-game-bar" aria-label="Game information">
      <strong className="mobile-round">Round {round}</strong>
      <span className="round-instruction" role="status">· {instruction}</span>
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

export function turnInstruction(phase: Phase, yours: boolean, name: string, moving: boolean, hand: readonly Pick<GameCard, 'rank'>[], penalty: number) {
  if (moving) return 'Moving cards…'
  if (phase === 'round-over' || phase === 'game-over') return 'Review the results.'
  if (!yours) return `Waiting for ${name} to play…`
  if (phase === 'penalty') return hand.some(card => card.rank === '7')
    ? `Play a 7 or draw ${penalty} penalty cards.` : 'Drawing penalty cards…'
  if (phase === 'draw') return 'Draw a new card or pick up the available card.'
  return hand.length ? 'Select cards to drop.' : 'Your hand is empty. Declare Least.'
}
