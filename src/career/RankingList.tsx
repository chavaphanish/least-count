import type { CSSProperties, ReactNode } from 'react'

export function RankingList({ ordered, label, count, className = '', onEnd, children }: {
  ordered?: boolean; label: string; count: number; className?: string
  onEnd?: () => void; children: ReactNode
}) {
  const List = ordered ? 'ol' : 'ul'
  return <div className="ranking-frame" data-scrollable={count > 5}
    style={{ '--ranking-count': Math.max(5, count), '--visible-rows': Math.max(1, Math.min(5, count)) } as CSSProperties}>
    <List className={`ranking-list ${className}`} aria-label={label} tabIndex={0}
      onScroll={({ currentTarget }) => {
        const range = currentTarget.scrollHeight - currentTarget.clientHeight
        currentTarget.parentElement?.style.setProperty('--rows-scrolled', String(5 * currentTarget.scrollTop / currentTarget.clientHeight))
        if (range > 0 && range - currentTarget.scrollTop < 2) onEnd?.()
      }}>
      {children}
    </List>
  </div>
}
