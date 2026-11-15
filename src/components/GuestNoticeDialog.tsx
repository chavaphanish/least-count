import { useEffect, useId, useRef } from 'react'
import { GUEST_MULTIPLAYER_NOTICE } from '../shared/multiplayer'
/** Reuse the table popup's theme and the browser's modal focus/inert behavior. */
export function GuestNoticeDialog({ onDismiss, heading = 'Online Multiplayer Unavailable' }: {
    onDismiss: () => void;
    heading?: string;
}) {
    const dialog = useRef<HTMLDialogElement>(null), title = useId();
    useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal() }, []);
    return <dialog ref={dialog} className="table-overlay guest-notice-dialog" role="alertdialog" aria-labelledby={title} onClose={onDismiss} onCancel={event => { event.preventDefault(); dialog.current?.close(); }}>
  <div className="table-overlay-shell">
   <header><h2 id={title}>{heading}</h2></header>
   <div className="table-overlay-body"><p>{GUEST_MULTIPLAYER_NOTICE}</p><button autoFocus className="button button-primary" type="button" onClick={() => dialog.current?.close()}>OK</button></div>
  </div>
 </dialog>;
}
