import type { GameCard } from '../game/deck'
import type { Phase } from '../game/engine'
import { cardLabel } from '../game/deck'
import { dropLabel } from '../lib/handSelection'
import { PlayingCard } from './PlayingCard'
import { useMobileLandscape } from './MobileOrientation'

const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

/** Presentation only: local reducer / authoritative room still validate every action. */
export function TurnActions({
  phase,
  yours,
  activeName,
  busy = false,
  moving = false,
  hand,
  selected,
  pickups,
  canDeclare,
  penalty,
  error,
  feedback,
  onDrop,
  onDraw,
  onPickup,
  onDeclare,
  onPenalty,
  onSelectAll,
  onClear,
}: {
  phase: Phase
  yours: boolean
  activeName: string
  busy?: boolean
  moving?: boolean
  hand: readonly GameCard[]
  selected: readonly GameCard[]
  pickups: readonly GameCard[]
  canDeclare: boolean
  penalty: number
  error?: string
  feedback?: string
  onDrop: () => void
  onDraw: () => void
  onPickup: (id: string) => void
  onDeclare: () => void
  onPenalty: () => void
  onSelectAll: () => void
  onClear: () => void
}) {
  const playing = ['turn', 'draw', 'penalty'].includes(phase)
  const mobile = useMobileLandscape()
  const actionable = yours && playing && !moving
  const replacing = phase === 'draw'
  const responding = phase === 'penalty'
  const replacementArea = replacing && yours
  const pickup = pickups[0]
  const hasSeven = hand.some(card => card.rank === '7')
  const legal = selected.length > 0 && selected.every(card =>
    hand.some(own => own.id === card.id) && card.rank === selected[0].rank && (!responding || card.rank === '7'),
  )
  const label = dropLabel(selected)
  let title: string
  let instruction: string
  if (moving) {
    title = 'TURN IN PROGRESS'
    instruction = 'Moving your cards…'
  } else if (!playing) {
    title = 'ROUND COMPLETE'
    instruction = 'Review the results below.'
  } else if (!yours) {
    title = 'WAITING'
    instruction = `Waiting for ${activeName} to play…`
  } else if (responding) {
    title = 'POWER CARD 7'
    instruction = hasSeven
      ? `Play a 7 or draw ${penalty} penalty cards`
      : 'Drawing your penalty cards…'
  } else if (replacing) {
    title = 'CHOOSE YOUR REPLACEMENT CARD'
    instruction = 'Choose your replacement card'
  } else {
    title = 'YOUR TURN'
    instruction = !hand.length
      ? 'Your hand is empty. Declare Least.'
      : legal ? label : 'Select cards to drop'
  }
  return (
    <section className={`turn-panel${replacementArea ? ' replacement-panel' : ''}`} aria-label="Turn actions" aria-busy={busy}>
      {!mobile && !replacementArea && <p className="action-stage">{title}</p>}
      <p className="turn-message" role="status">{instruction}</p>
      {feedback && !mobile && <p className="action-hint" role="status">{feedback}</p>}
      {error && <p className="game-alert" role="alert">{error}</p>}
      {actionable && (
        <>
          <div className="turn-actions">
            {!replacing && (!responding || hasSeven) && !!hand.length && (
              <button className="button button-primary" data-plan-discard disabled={busy || !legal} onClick={onDrop}>
                {responding && !selected.length ? 'Play 7' : label}
              </button>
            )}
            {!replacing && !responding && canDeclare && (
              <button className="button button-secondary" disabled={busy} onClick={onDeclare}>Declare Least</button>
            )}
            {replacing && <button className="button button-primary" data-primary-draw disabled={busy} onClick={onDraw}>Draw New Card</button>}
            {replacing && pickup && (
              <button className="button button-primary pickup-button eligible-pickup" data-pickup-card={pickup.id} disabled={busy} aria-label={`Pick up ${cardLabel(pickup)}`} onClick={() => onPickup(pickup.id)}>
                <span className="pickup-preview"><PlayingCard card={pickup} /></span>
                <span>Pick Up {pickup.rank === 'PJ' ? 'Joker' : `${pickup.rank}${suits[pickup.suit]}`}</span>
              </button>
            )}
            {responding && hasSeven && <button className="button button-secondary" disabled={busy} onClick={onPenalty}>Draw {penalty} Penalty Cards</button>}
          </div>
          {!replacing && selected.length > 0 && (
            <div className="selection-actions">
              {hand.filter(card => card.rank === selected[0].rank).length > selected.length &&
                <button className="text-button" disabled={busy} onClick={onSelectAll}>Select All Matching</button>}
              <button className="text-button" disabled={busy} onClick={onClear}>Clear selection</button>
            </div>
          )}
          {!mobile && !replacing && !responding && canDeclare && !!hand.length && <p className="action-hint">You can Declare Least, or continue with a Drop.</p>}
        </>
      )}
    </section>
  )
}
