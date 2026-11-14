import { useEffect, useId, useRef, useState } from 'react'
import { PlayerIdentity } from './PlayerIdentity'
import { gameplayIdentity } from '../shared/playerIdentity'
import type { ClientGameAction, RoomView } from '../shared/multiplayer'
import './host-transfer.css'

/** Only the eliminated host opens this modal; its room subscription keeps running. */
export function HostTransferDialog({ room, now, busy, live, error, send }: {
  room: RoomView; now: number; busy: boolean; live: boolean; error: string;
  send: (action: ClientGameAction) => boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId(), description = useId(), group = useId()
  const [selected, setSelected] = useState('')
  const transfer = room.hostTransfer!
  const eligibleKey = transfer.eligibleIds.join(',')
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    setSelected(value => transfer.eligibleIds.includes(value) ? value : '')
  }, [eligibleKey])
  const valid = transfer.eligibleIds.includes(selected)
  return <dialog ref={dialog} className="table-overlay host-transfer-dialog" aria-labelledby={title} aria-describedby={description} onCancel={event => event.preventDefault()}>
    <div className="table-overlay-shell">
      <header><h2 id={title}>Transfer Host Role</h2></header>
      <div className="table-overlay-body">
        <p id={description}>You have been eliminated. Please select a player to take over as host.</p>
        <div className="host-transfer-options" role="radiogroup" aria-label="New host">
          {room.game!.players.filter(player => !player.eliminated).map(player => {
            const eligible = transfer.eligibleIds.includes(player.id)
            return <label key={player.id} className={`button host-transfer-option ${valid && selected === player.id ? 'button-primary' : 'button-secondary'}`}>
              <input className="visually-hidden" type="radio" name={group} value={player.id} checked={valid && selected === player.id} disabled={!eligible || busy || !live} onChange={() => setSelected(player.id)} />
              <PlayerIdentity player={gameplayIdentity(player)} compact avatar />
              {!eligible && <small>Offline</small>}
            </label>
          })}
        </div>
        {error && <p className="host-transfer-error" role="alert">{error}</p>}
        <div className="host-transfer-footer">
          <small>Automatic transfer in {Math.max(0, Math.ceil((transfer.deadline - now) / 1000))}s</small>
          <button className="button button-primary" disabled={!valid || busy || !live} onClick={() => send({ type: 'transfer-host', targetId: selected, transferId: transfer.id })}>Transfer Host</button>
        </div>
      </div>
    </div>
  </dialog>
}
