import { useRef } from 'react'

export function QuitGame({ onQuit }: { onQuit: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  return <><button className="button button-secondary" onClick={() => dialog.current?.showModal()}>Quit Game</button>
    <dialog ref={dialog} className="table-overlay" aria-label="Quit Game?"><div className="table-overlay-shell"><header><h2>Quit Game?</h2></header>
      <div className="table-overlay-body"><p>Are you sure you want to quit? You will forfeit this game and cannot rejoin it.</p>
      <button autoFocus className="button button-secondary" onClick={() => dialog.current?.close()}>Cancel</button>
      <button className="button button-primary" onClick={() => { dialog.current?.close(); onQuit() }}>Quit Game</button></div>
    </div></dialog></>
}
