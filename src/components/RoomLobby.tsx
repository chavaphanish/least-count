import type { CSSProperties } from 'react'
import type { ClientGameAction, RoomView } from '../shared/multiplayer'
import { LOBBY_THRESHOLDS } from '../shared/multiplayer'
import { Avatar } from './Avatar'
import { PlayerIdentity } from './PlayerIdentity'
import { gameplayIdentity } from '../shared/playerIdentity'
import './room-lobby.css'

export function RoomLobby({ room, id, live, busy, send, start, share }: {
  room: RoomView; id: string; live: boolean; busy: boolean
  send: (action: ClientGameAction) => boolean; start: () => void; share: () => void
}) {
  const host = room.hostId === id
  const connected = room.members.filter(m => m.connected && !m.left).length
  const full = room.members.length === room.settings.maxPlayers && connected === room.settings.maxPlayers
  return <div className="room-lobby">
    <div className="room-code-panel">
      <div><span>ROOM CODE</span><strong>{room.code}</strong></div>
      <button className="button button-secondary compact-button" onClick={share}>Share Invitation</button>
    </div>
    <div className="lobby-layout">
      <section className="lobby-settings" aria-label="Game Settings">
        <h2>Game Settings</h2>
        {host ? <>
          <label>Elimination threshold
            <select value={room.settings.eliminationThreshold} disabled={busy || !live}
              onChange={event => send({ type: 'update-settings', settings: { eliminationThreshold: Number(event.target.value) } })}>
              {!LOBBY_THRESHOLDS.some(value => value === room.settings.eliminationThreshold) && <option value={room.settings.eliminationThreshold}>{room.settings.eliminationThreshold} (current)</option>}
              {LOBBY_THRESHOLDS.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Number of players
            <select value={room.settings.maxPlayers} disabled={busy || !live}
              onChange={event => send({ type: 'update-settings', settings: { maxPlayers: Number(event.target.value) } })}>
              {Array.from({ length: 7 }, (_, i) => i + 2).map(value => <option key={value} value={value} disabled={value < room.members.length}>{value}</option>)}
            </select>
          </label>
        </> : <dl>
          <div><dt>Elimination threshold</dt><dd>{room.settings.eliminationThreshold}</dd></div>
          <div><dt>Number of players</dt><dd>{room.settings.maxPlayers}</dd></div>
        </dl>}
      </section>
      <div className="lobby-players">
        <div className="lobby-count"><h2>{connected}/{room.settings.maxPlayers} Players</h2></div>
        <div className="lobby-grid" style={{ '--lobby-columns': Math.min(room.settings.maxPlayers, 4), '--lobby-rows': Math.ceil(room.settings.maxPlayers / 4) } as CSSProperties}>
          {room.members.map(m => <article className={`lobby-player ${!m.connected ? 'disconnected-player' : ''}`} key={m.id}
            data-player-id={m.id} data-host={m.id === room.hostId} data-connected={m.connected}>
            <Avatar player={m} />
            <h3><PlayerIdentity player={gameplayIdentity(m)} compact />{m.id === id ? ' (You)' : ''}</h3>
            <span className="account-badge">{m.accountType === 'guest' ? 'Guest' : 'Registered'}{m.id === room.hostId ? ' · Host' : ''}</span>
            <p>{m.connected ? 'Connected' : 'Reconnecting · seat reserved'}</p>
          </article>)}
          {Array.from({ length: Math.max(0, room.settings.maxPlayers - room.members.length) }, (_, index) =>
            <article className="lobby-player empty-seat" key={`seat-${index}`}><span aria-hidden="true">♧</span><h3>Available seat</h3></article>)}
        </div>
        <div className="lobby-start">
          <p role="status">{!live ? 'Reconnecting…' : full ? host ? 'Ready to start' : 'Waiting for host to start' : 'Waiting for players'}</p>
          {host && <button className="button button-primary" disabled={!full || busy || !live} onClick={start}>Start Game</button>}
        </div>
      </div>
    </div>
  </div>
}
