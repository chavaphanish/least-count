import { useLayoutEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { PlayingCard } from './PlayingCard'
import type { GameCard } from '../game/deck'

export type CardRect = {
  left: number
  top: number
  width: number
  height: number
}
export type CardDeparture = { card: GameCard; from: CardRect }
export type TurnMotion = {
  outgoing: CardDeparture[]
  incoming?: CardDeparture & { faceDown: boolean }
}
type Flight = CardDeparture & {
  to: CardRect
  faceDown?: boolean
  rotation: number
  direction: string
}
export const TURN_MOTION_MS = 650

export function cardRect(element: Element | null): CardRect | null {
  if (!element) return null
  const { left, top, width, height } = element.getBoundingClientRect()
  return width && height
    ? { left: left + window.scrollX, top: top + window.scrollY, width, height }
    : null
}

/** Decorative only: the validated state is committed before these flights start. */
export function TurnAnimation({
  motion,
  onComplete,
}: {
  motion: TurnMotion
  onComplete: () => void
}) {
  const [flights, setFlights] = useState<Flight[]>([])
  const [stage, setStage] = useState('outgoing')
  const sequential =
    flights.some((f) => f.direction === 'outgoing') &&
    flights.some((f) => f.direction === 'incoming')
  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) {
      onComplete()
      return
    }
    const next: Flight[] = []
    const discard = cardRect(
      document.querySelector('[data-discard-target] .playing-card'),
    )
    if (discard)
      motion.outgoing.forEach((departure, index) =>
        next.push({
          ...departure,
          to: {
            ...discard,
            left: discard.left + (index - (motion.outgoing.length - 1) / 2) * 5,
          },
          rotation: (index - (motion.outgoing.length - 1) / 2) * 5,
          direction: 'outgoing',
        }),
      )
    if (motion.incoming) {
      const destination = Array.from(
        document.querySelectorAll('[data-hand-card]'),
      ).find(
        (element) =>
          element.getAttribute('data-hand-card') === motion.incoming!.card.id,
      )
      const to = cardRect(destination?.querySelector('.playing-card') ?? null)
      if (to)
        next.push({
          ...motion.incoming,
          to,
          rotation: 0,
          direction: 'incoming',
        })
    }
    if (!next.length) {
      onComplete()
      return
    }
    setFlights(next)
    const paired =
      next.some((f) => f.direction === 'outgoing') &&
      next.some((f) => f.direction === 'incoming')
    setStage(
      next.some((f) => f.direction === 'outgoing') ? 'outgoing' : 'incoming',
    )
    const nextStage = paired
      ? window.setTimeout(() => setStage('incoming'), TURN_MOTION_MS / 2)
      : undefined
    const timer = window.setTimeout(onComplete, TURN_MOTION_MS)
    // Document coordinates keep flights attached to the table while scrolling.
    // A resize invalidates layout measurements; finish without replaying the turn.
    window.addEventListener('resize', onComplete)
    reduced.addEventListener('change', onComplete)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(nextStage)
      window.removeEventListener('resize', onComplete)
      reduced.removeEventListener('change', onComplete)
    }
  }, [motion, onComplete])
  return createPortal(
    <div
      className="turn-animation"
      data-testid="turn-animation"
      data-phase={stage}
      aria-hidden="true"
    >
      {flights
        .filter((flight) => flight.direction === stage)
        .map((flight, index) => {
          const dx = flight.to.left - flight.from.left
          const dy = flight.to.top - flight.from.top
          const style = {
            left: flight.from.left,
            top: flight.from.top,
            width: flight.from.width,
            height: flight.from.height,
            '--flight-width': `${flight.from.width}px`,
            '--flight-dx': `${dx}px`,
            '--flight-dy': `${dy}px`,
            '--flight-mid-x': `${dx * 0.5}px`,
            '--flight-mid-y': `${dy * 0.5 - 35}px`,
            '--flight-scale-x': flight.to.width / flight.from.width,
            '--flight-scale-y': flight.to.height / flight.from.height,
            '--flight-rotation': `${flight.rotation}deg`,
            '--flight-duration': `${sequential ? TURN_MOTION_MS / 2 : TURN_MOTION_MS}ms`,
          } as CSSProperties
          return (
            <div
              className={`card-flight flight-${flight.direction}`}
              data-direction={flight.direction}
              style={style}
              key={`${flight.direction}-${index}`}
            >
              <PlayingCard card={flight.card} faceDown={flight.faceDown} />
            </div>
          )
        })}
    </div>,
    document.body,
  )
}
