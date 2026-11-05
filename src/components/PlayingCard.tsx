import type { Suit } from '../game/cards'
import type { GameCard } from '../game/deck'
import { cardLabel } from '../game/deck'

const symbols: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

type PlayingCardProps = {
  card?: GameCard
  faceDown?: boolean
  className?: string
}

export function PlayingCard({
  card,
  faceDown = false,
  className = '',
}: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={`playing-card card-back ${className}`}
        role="img"
        aria-label="Face-down card"
      >
        <span aria-hidden="true">♠</span>
      </div>
    )
  }
  if (card.rank === 'PJ') {
    return (
      <div
        className={`playing-card printed-joker ${className}`}
        role="img"
        aria-label="Printed Joker"
      >
        <span className="joker-corner" aria-hidden="true">
          PJ
        </span>
        <span className="joker-center" aria-hidden="true">
          ♧<small>JOKER</small>
        </span>
      </div>
    )
  }
  const symbol = symbols[card.suit]
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <div
      className={`playing-card ${red ? 'card-red' : ''} ${className}`}
      role="img"
      aria-label={cardLabel(card)}
    >
      <span className="card-corner" aria-hidden="true">
        {card.rank}
        <small>{symbol}</small>
      </span>
      <span className="card-pip" aria-hidden="true">
        {symbol}
      </span>
      <span className="card-corner card-corner-bottom" aria-hidden="true">
        {card.rank}
        <small>{symbol}</small>
      </span>
    </div>
  )
}
