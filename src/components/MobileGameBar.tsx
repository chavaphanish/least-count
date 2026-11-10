import { useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { useMobileLandscape } from './MobileOrientation'
import { TableOverlay } from './TableOverlay'
import { ScreenPages, PagedItems } from './ScreenPages'
import { TurnTimer } from './TurnTimer'
import type { GameCard } from '../game/deck'

export function MobileGameBar({
  round,
  activeName,
  seconds,
  joker,
  penalty,
  players,
  children,
}: {
  round: number
  activeName: string
  seconds: number | null
  joker: Pick<GameCard, 'rank' | 'suit'>
  penalty: number
  players: { id: string; name: string; score: number; eliminated: boolean }[]
  children: ReactNode
}) {
  const mobile = useMobileLandscape()
  useLayoutEffect(() => {
    if (mobile) window.scrollTo(0, 0)
  }, [mobile])
  if (!mobile) return null
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
      <TableOverlay label="Table options" trigger="Table ☰">
        <ScreenPages
          label="Table sections"
          pages={[
            {
              label: 'Room & help',
              content: <div className="table-options">{children}</div>,
            },
            {
              label: 'Match scores',
              content: (
                <section className="match-scores">
                  <h2>Match scores</h2>
                  <PagedItems as="ul" label="scores" size={4}>
                    {players.map((p) => (
                      <li key={p.id}>
                        <span>{p.name}</span>
                        <strong>{p.score}</strong>
                        <small>{p.eliminated ? 'Eliminated' : 'Active'}</small>
                      </li>
                    ))}
                  </PagedItems>
                </section>
              ),
            },
          ]}
        />
      </TableOverlay>
    </header>
  )
}
