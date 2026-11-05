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
          ★
        </span>
        <span className="joker-center" aria-hidden="true">
          <svg
            className="jester-art"
            viewBox="0 0 100 110"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M22 58 Q14 35 9 28 Q32 24 40 43 Q41 13 50 9 Q64 24 61 44 Q78 24 91 29 Q81 44 78 58 Z"
              fill="currentColor"
            />
            <path d="M42 44 Q45 21 50 15 Q58 29 57 45 Z" fill="#b95842" />
            <g fill="#d7b96e">
              <circle cx="9" cy="27" r="5" />
              <circle cx="50" cy="9" r="5" />
              <circle cx="91" cy="28" r="5" />
            </g>
            <path
              d="M25 53 Q50 43 75 53 L72 72 Q68 91 50 95 Q32 91 28 72 Z"
              fill="#ead5a4"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M35 65 Q40 60 44 65 M56 65 Q61 60 66 65"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M39 77 Q50 89 62 77"
              fill="none"
              stroke="#b95842"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M28 91 L18 103 L39 98 L50 108 L61 98 L82 103 L72 91"
              fill="#b95842"
            />
          </svg>
          <small>JOKER</small>
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
