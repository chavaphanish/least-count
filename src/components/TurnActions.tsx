import type { GameCard } from '../game/deck'
import type { Phase } from '../game/engine'
import { cardLabel } from '../game/deck'
import { dropLabel } from '../lib/handSelection'
import { PlayingCard } from './PlayingCard'

const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

/** Presentation only: local reducer / authoritative room still validate every action. */
export function TurnActions({
  phase,
  yours,
  busy = false,
  moving = false,
  hand,
  selected,
  pickups,
  canDeclare,
  penalty,
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
  busy?: boolean
  moving?: boolean
  hand: readonly GameCard[]
  selected: readonly GameCard[]
  pickups: readonly GameCard[]
  canDeclare: boolean
  penalty: number
  onDrop: () => void
  onDraw: () => void
  onPickup: (id: string) => void
  onDeclare: () => void
  onPenalty: () => void
  onSelectAll: () => void
  onClear: () => void
}) {
  const playing = ['turn', 'draw', 'penalty'].includes(phase)
  const actionable = yours && playing && !moving
  const replacing = phase === 'draw'
  const responding = phase === 'penalty'
  const pickup = pickups[0]
  const hasSeven = hand.some(card => card.rank === '7')
  const legal = selected.length > 0 && selected.every(card =>
    hand.some(own => own.id === card.id) && card.rank === selected[0].rank && (!responding || card.rank === '7'),
  )
  const label = dropLabel(selected)
  return (
    <section className="turn-panel" aria-label="Turn actions" aria-busy={busy}>
      <div className="game-action-rail" role="group" aria-label="Available turn actions">
        {actionable && (
          <>
            <div className="turn-actions">
              {!replacing && (!responding || hasSeven) && !!hand.length && (
                <button className="button button-primary game-action" data-plan-discard disabled={busy || !legal} onClick={onDrop}>
                  {responding && !selected.length ? 'Play 7' : label}
                </button>
              )}
              {!replacing && !responding && canDeclare && (
                <button className="button button-primary game-action" disabled={busy} onClick={onDeclare}>Declare Least</button>
              )}
              {replacing && <button className="button button-primary game-action" data-primary-draw disabled={busy} onClick={onDraw}>Draw New Card</button>}
              {replacing && pickup && (
                <button className="button button-primary game-action pickup-button eligible-pickup" data-pickup-card={pickup.id} disabled={busy} aria-label={`Pick up ${cardLabel(pickup)}`} onClick={() => onPickup(pickup.id)}>
                  <span className="pickup-preview"><PlayingCard card={pickup} /></span>
                  <span>Pick Up {pickup.rank === 'PJ' ? 'Joker' : `${pickup.rank}${suits[pickup.suit]}`}</span>
                </button>
              )}
              {responding && hasSeven && <button className="button button-primary game-action" disabled={busy} onClick={onPenalty}>Draw {penalty} Penalty Cards</button>}
            </div>
            {!replacing && selected.length > 0 && (
              <div className="selection-actions">
                {hand.filter(card => card.rank === selected[0].rank).length > selected.length &&
                  <button className="button button-primary game-action" disabled={busy} onClick={onSelectAll}>Select All Matching</button>}
                <button className="button button-primary game-action" disabled={busy} onClick={onClear}>Clear selection</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
