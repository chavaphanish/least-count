import type { Card, Suit } from '../game/cards'

const symbols: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

type PlayingCardProps = { card?: Card; faceDown?: boolean; className?: string }

export function PlayingCard({ card, faceDown = false, className = '' }: PlayingCardProps) {
  if (faceDown || !card) {
    return <div className={`playing-card card-back ${className}`} role="img" aria-label="Face-down card"><span aria-hidden="true">♠</span></div>
  }
  const symbol = symbols[card.suit]
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <div className={`playing-card ${red ? 'card-red' : ''} ${className}`} role="img" aria-label={`${card.rank} of ${card.suit}`}>
      <span className="card-corner" aria-hidden="true">{card.rank}<small>{symbol}</small></span>
      <span className="card-pip" aria-hidden="true">{symbol}</span>
      <span className="card-corner card-corner-bottom" aria-hidden="true">{card.rank}<small>{symbol}</small></span>
    </div>
  )
}
