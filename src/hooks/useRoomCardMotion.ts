import { useCallback, useEffect, useRef, useState } from 'react'
import { cardRect, handCardRect } from '../components/TurnAnimation'
import type {
  CardDeparture,
  CardRect,
  TurnMotion,
} from '../components/TurnAnimation'
import type { ClientGameAction, RoomView } from '../shared/multiplayer'
import { discardOutcome } from '../game/engine'

type PendingMotion = {
  revision: number
  handIds: string[]
  outgoing: CardDeparture[]
  source: 'pile' | 'discard' | null
  from: CardRect | null
}
function cardElement(attribute: string, id: string) {
  return (
    Array.from(document.querySelectorAll(`[${attribute}]`))
      .find((el) => el.getAttribute(attribute) === id)
      ?.querySelector('.playing-card') ?? null
  )
}
/** Capture old geometry at intent time; animate only after an authoritative hand update. */
export function useRoomCardMotion(
  room: RoomView | null,
  busy: boolean,
  error: string,
  send: (action: ClientGameAction) => boolean,
) {
  const [motion, setMotion] = useState<TurnMotion | null>(null)
  const pending = useRef<PendingMotion | null>(null)
  const finishMotion = useCallback(() => setMotion(null), [])
  useEffect(() => {
    const p = pending.current
    const g = room?.game
    if (!p || !g) return
    if (error && !busy) {
      pending.current = null
      return
    }
    if (room!.revision <= p.revision) return
    const outgoing = p.outgoing.filter(
      (d) =>
        !g.hand.some((c) => c.id === d.card.id) &&
        g.latestDiscard.some((c) => c.id === d.card.id),
    )
    const incoming =
      p.source && p.from
        ? g.hand.find((c) => !p.handIds.includes(c.id))
        : undefined
    if (!outgoing.length && !incoming) {
      if (!busy) pending.current = null
      return
    }
    pending.current = null
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setMotion({
      outgoing,
      incoming:
        incoming && p.from
          ? { card: incoming, from: p.from, faceDown: p.source === 'pile' }
          : undefined,
    })
  }, [room, busy, error])
  const move = useCallback(
    (action: ClientGameAction) => {
      const g = room?.game
      if (!g || motion || busy) return false
      const outgoing =
        action.type === 'discard'
          ? g.hand
              .filter((c) => action.cardIds?.includes(c.id))
              .flatMap((card) => {
                const from = handCardRect(cardElement('data-hand-card', card.id))
                return from ? [{ card, from }] : []
              })
          : []
      let source: PendingMotion['source'] =
        action.type === 'draw' ? (action.source ?? null) : null
      if (
        action.type === 'discard' &&
        outgoing.length &&
        discardOutcome(
          g.phase,
          outgoing[0].card.rank,
          g.latestDiscard.at(-1)?.rank,
          g.pickup.length > 0,
        ) === 'automatic'
      )
        source = 'pile'
      const from =
        source === 'pile'
          ? cardRect(document.querySelector('[data-draw-source] .playing-card'))
          : source === 'discard' && action.cardId
            ? (cardRect(cardElement('data-pickup-card', action.cardId)) ?? cardRect(document.querySelector('[data-discard-target] .playing-card')))
            : null
      pending.current = {
        revision: room!.revision,
        handIds: g.hand.map((c) => c.id),
        outgoing,
        source,
        from,
      }
      if (!send(action)) {
        pending.current = null
        return false
      }
      return true
    },
    [room, motion, busy, send],
  )
  return { motion, move, finishMotion }
}
