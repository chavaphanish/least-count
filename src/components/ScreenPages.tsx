import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useState,
} from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useAppViewport, useMobileLandscape } from './MobileOrientation'
export function ScreenPages({
  pages,
  label = 'Sections',
  value,
  onChange,
}: {
  pages: { label: string; content: ReactNode }[]
  label?: string
  value?: number
  onChange?: (index: number) => void
}) {
  const mobile = useMobileLandscape()
  const [index, setIndex] = useState(0)
  const current = Math.min(value ?? index, pages.length - 1)
  const change = (n: number) => {
    setIndex(n)
    onChange?.(n)
  }
  if (!mobile)
    return (
      <>
        {pages.map((p, i) => (
          <Fragment key={i}>{p.content}</Fragment>
        ))}
      </>
    )
  return (
    <div className="screen-pages">
      <nav className="screen-page-tabs" aria-label={label}>
        <button
          type="button"
          aria-label={`Previous ${label}`}
          disabled={!current}
          onClick={() => change(current - 1)}
        >
          ‹
        </button>
        <select
          aria-label={label}
          value={current}
          onChange={(e) => change(Number(e.target.value))}
        >
          {pages.map((p, i) => (
            <option key={i} value={i}>
              {p.label} · {i + 1}/{pages.length}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Next ${label}`}
          disabled={current === pages.length - 1}
          onClick={() => change(current + 1)}
        >
          ›
        </button>
      </nav>
      <div className="screen-page-content">
        {pages.map((p, i) => (
          <div className="screen-page" key={i} hidden={i !== current}>
            {p.content}
          </div>
        ))}
      </div>
    </div>
  )
}
export function PagedItems({
  children,
  label = 'Items',
  size = 3,
  as: Container = 'div',
  className = '',
}: {
  children: ReactNode
  label?: string
  size?: number
  as?: 'div' | 'ul' | 'ol' | 'dl'
  className?: string
}) {
  const mobile = useMobileLandscape()
  const { height } = useAppViewport()
  const [page, setPage] = useState(0)
  const items = Children.toArray(children)
  const count = mobile
    ? Math.max(1, height < 230 ? 1 : size)
    : Math.max(1, items.length)
  const pages = Math.ceil(items.length / count),
    current = Math.min(page, Math.max(0, pages - 1))
  return (
    <>
      <Container className={className}>
        {items.map((item, i) =>
          isValidElement(item)
            ? cloneElement(
                item as ReactElement<{
                  hidden?: boolean
                  'data-page-item'?: boolean
                }>,
                {
                  hidden: mobile && Math.floor(i / count) !== current,
                  'data-page-item': true,
                },
              )
            : item,
        )}
      </Container>
      {mobile && pages > 1 && (
        <nav className="item-pages" aria-label={`${label} pages`}>
          <button
            type="button"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            Previous {label}
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next {label}
          </button>
        </nav>
      )}
    </>
  )
}
