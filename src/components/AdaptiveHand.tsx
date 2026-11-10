import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { layoutHand } from '../presentation/handLayout'
export function AdaptiveHand({
  children,
  empty,
}: {
  children: ReactNode
  empty: ReactNode
}) {
  const region = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  useLayoutEffect(() => {
    const element = region.current!
    const update = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => observer.disconnect()
  }, [])
  const [inspection, setInspection] = useState<number | null>(null)
  const pointer = useRef<number | null>(null)
  const suppressClickUntil = useRef(0)
  const cards = Children.toArray(children)
  const layout = layoutHand(cards.length, size.width, size.height)
  const inspect = (clientX: number) => {
    const bounds = region.current!.getBoundingClientRect()
    return Math.max(
      0,
      Math.min(
        cards.length - 1,
        Math.floor(
          (clientX - bounds.left - (layout.items[0]?.x ?? 0)) /
            Math.max(0.001, layout.stepX),
        ),
      ),
    )
  }
  const inspected =
    inspection === null ? null : cards[Math.min(inspection, cards.length - 1)]
  const description = isValidElement<{ 'aria-label'?: string }>(inspected)
    ? inspected.props['aria-label']
    : ''
  return (
    <div
      ref={region}
      className="player-hand adaptive-hand"
      role="group"
      aria-label="Your hand"
      data-hand-target
      data-rows={layout.rows}
      data-density={layout.compact ? 'compact' : 'standard'}
      onFocusCapture={(event) => {
        const index = Array.from(
          region.current!.querySelectorAll('.hand-card'),
        ).indexOf(event.target as Element)
        if (index >= 0) setInspection(index)
      }}
      onPointerDown={(event) => {
        if (!layout.compact || !cards.length || event.button !== 0) return
        event.preventDefault()
        pointer.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        setInspection(inspect(event.clientX))
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId)
          setInspection(inspect(event.clientX))
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return
        const index = inspect(event.clientX)
        pointer.current = null
        suppressClickUntil.current = performance.now() + 500
        setInspection(index)
        region
          .current!.querySelectorAll<HTMLButtonElement>('.hand-card')
          [index]?.click()
      }}
      onPointerCancel={() => {
        pointer.current = null
      }}
      onClickCapture={(event) => {
        if (event.isTrusted && performance.now() < suppressClickUntil.current) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      {layout.compact && (
        <output className="hand-inspection" aria-live="polite">
          {description
            ? `${description} · ${(inspection ?? 0) + 1}/${cards.length}`
            : 'Hold and move across your hand to inspect; release to select.'}
        </output>
      )}
      {cards.map((node, i) => {
        if (!isValidElement(node)) return node
        const card = node as ReactElement<{
          style?: CSSProperties
          className?: string
        }>
        const p = layout.items[i]
        const selected = card.props.className?.includes('selected-card')
        return cloneElement(card, {
          style: {
            ...card.props.style,
            left: p.x,
            top: p.y,
            width: p.hitWidth,
            height: p.hitHeight,
            zIndex: selected ? 2000 : i + 1,
            '--card-width': `${layout.cardWidth}px`,
            '--adaptive-height': `${layout.cardHeight}px`,
            '--hit-width': `${p.hitWidth}px`,
            '--hit-height': `${p.hitHeight}px`,
            '--selection-lift': `${layout.lift}px`,
            '--corner-font': `${Math.min(14, Math.max(11, layout.cardWidth * 0.2))}px`,
          } as CSSProperties,
        })
      })}
      {!cards.length && <p className="empty-hand">{empty}</p>}
    </div>
  )
}
