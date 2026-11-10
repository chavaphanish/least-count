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
  const cards = Children.toArray(children)
  const layout = layoutHand(cards.length, size.width, size.height)
  return (
    <div
      ref={region}
      className="player-hand adaptive-hand"
      role="group"
      aria-label="Your hand"
      data-hand-target
      data-rows={layout.rows}
    >
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
