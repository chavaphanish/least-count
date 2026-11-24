import type { ReactNode } from 'react'
import { AdaptiveHand } from './AdaptiveHand'

export function PlayerHand({ total, active, children, empty }: {
  total: number
  active: boolean
  children: ReactNode
  empty: ReactNode
}) {
  return <div className="your-live-seat" data-active={active}>
    <strong className="hand-value" data-testid="hand-total">{total} points</strong>
    <AdaptiveHand empty={empty}>{children}</AdaptiveHand>
  </div>
}
