import { useId, useRef } from 'react'
import type { ReactNode } from 'react'

/** Native modal focus/inert behavior; opening a panel never changes game state. */
export function TableOverlay({ label, trigger, triggerClass = 'table-tool', children }: {
  label: string; trigger: ReactNode; triggerClass?: string; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  return <>
    <button type="button" className={triggerClass} aria-haspopup="dialog" aria-label={label} onClick={() => dialog.current?.showModal()}>{trigger}</button>
    <dialog ref={dialog} className="table-overlay" aria-labelledby={title} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="table-overlay-shell">
        <header><h2 id={title}>{label}</h2><button type="button" className="text-button" onClick={() => dialog.current?.close()}>Close</button></header>
        <div className="table-overlay-body">{children}</div>
      </div>
    </dialog>
  </>
}
