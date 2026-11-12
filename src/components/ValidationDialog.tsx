import { useEffect, useId, useRef } from 'react';
/** Reuse the table popup's theme and the browser's modal focus/inert behavior. */
export function ValidationDialog({ errors, onDismiss, heading = 'Check your details' }: {
    errors: string[];
    heading?: string;
    onDismiss: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null), title = useId();
    useEffect(() => { if (errors.length && !dialog.current?.open)
        dialog.current?.showModal(); }, [errors]);
    return <dialog ref={dialog} className="table-overlay validation-dialog" role="alertdialog" aria-labelledby={title} aria-describedby={`${title}-errors`} onClose={onDismiss} onCancel={event => { event.preventDefault(); dialog.current?.close(); }}>
  <div className="table-overlay-shell">
   <header><h2 id={title}>{heading}</h2></header>
   <div className="table-overlay-body"><ul id={`${title}-errors`}>{errors.map(message => <li key={message}>{message}</li>)}</ul><button autoFocus className="button button-primary" type="button" onClick={() => dialog.current?.close()}>OK</button></div>
  </div>
 </dialog>;
}
