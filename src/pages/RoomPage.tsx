import { RoomLobby } from '../components/RoomLobby'
import { invitationMessage, shareRoomInvitation } from '../lib/roomInvitation'
import { GameNotices } from '../components/GameNotices'
import { HostTransferDialog } from '../components/HostTransferDialog'
import { GuestNoticeDialog } from '../components/GuestNoticeDialog'
import { useGameFeedback } from '../feedback/FeedbackProvider'
import { useGameplayLoading } from '../components/NavigationLoading'
import { ResultScores, resultTitle } from '../components/ResultScores'
import { MobileGameBar } from '../components/MobileGameBar'
import { OpponentSeat } from '../components/OpponentSeat'
import { QuitGame } from '../components/QuitGame'
import { useActiveSeat } from '../hooks/useActiveSeat'
import { TurnActions } from '../components/TurnActions'
import { TurnTimer } from '../components/TurnTimer'
import { latestActionHint, toggleHandCard } from '../lib/handSelection'
import { PlayerHand } from '../components/PlayerHand'
import { TurnAnimation } from '../components/TurnAnimation'
import { useRoomCardMotion } from '../hooks/useRoomCardMotion'
import { GameActivity } from '../components/GameActivity'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRoom } from '../hooks/useRoom'
import { gameplayIdentity, playerFirstName } from '../shared/playerIdentity'
import { PlayerIdentity } from '../components/PlayerIdentity'
import { PlayingCard } from '../components/PlayingCard'
import { cardLabel, handTotal } from '../game/deck'
export function RoomPage({
  code,
  onJoined,
  onExit,
}: {
  code: string
  onJoined: () => void
  onExit: () => void
}) {
  const auth = useAuth()
  const local = useRoom(code)
  const { room, connection, error, busy, now, send, command, guestBlocked } =
    local
  useGameplayLoading(!!room?.game)
  useGameFeedback(room?.game ? {scope:`room:${room.matchId ?? room.id}`,revision:room.revision,round:room.game.round,phase:room.game.phase,dropIds:room.game.latestDiscard.map(c=>c.id).join(','),localId:auth.user!.player.id,currentId:room.game.currentPlayerId,players:room.game.players,events:room.game.events,deadline:room.game.deadline,now,connected:connection==='live',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches} : null)
  useActiveSeat(room?.game?.currentPlayerId)
  const id = auth.user!.player.id
  const {
    motion: animation,
    move,
    finishMotion,
  } = useRoomCardMotion(room, busy, error, send)
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [selectionError, setSelectionError] = useState('')
  useEffect(() => {
    if (room) onJoined()
  }, [room?.id, onJoined])
  const invitation = `${location.origin}/join/${code}`
  const invitationDialog = useRef<HTMLDialogElement>(null)
  const invitationTitle = useId()
  const [invitationFailed, setInvitationFailed] = useState(false)
  const manualInvitation = (failed: boolean) => {
    setInvitationFailed(failed)
    invitationDialog.current?.showModal()
  }
  const copiedInvitation = () => setNotice('Invitation copied. Paste it into your messaging app.')
  const share = () => {
    setNotice('')
    shareRoomInvitation(code, invitation, copiedInvitation, manualInvitation)
  }
  if (!room)
    return (
      <section
        className={`room-page ${animation ? 'turn-in-motion' : ''} ${animation?.outgoing.length ? 'turn-discard-in-motion' : ''}`}
      >
        {guestBlocked && (
          <GuestNoticeDialog
            onDismiss={() => {
              onExit()
              location.hash = '#/'
            }}
          />
        )}
        <h1>
          {connection === 'error'
            ? 'Room unavailable'
            : 'Connecting to your table…'}
        </h1>
        {error && (
          <p className="game-alert" role="alert">
            {error}
          </p>
        )}
        <div className="auth-actions">
          <button className="button button-primary" onClick={local.reconnect}>
            Retry connection
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              onExit()
              location.hash = '#/'
            }}
          >
            Back to Lounge
          </button>
        </div>
      </section>
    )
  const host = room.hostId === id && !room.hostTransfer
  const g = room.game
  const own = g?.players.find((p) => p.id === id)
  const current = g?.players.find((p) => p.id === g.currentPlayerId)
  const activeName = current ? playerFirstName(current) : 'the active player'
  const players = g?.players.map(p => ({ ...p, name: playerFirstName(p) })) ?? []
  const required = room.requiredReady ?? []
  const readyPlayers = room.ready ?? []
  const readyCount = required.filter(player => readyPlayers.includes(player)).length
  const quit = () => { void command('quit') }
  const yours =
    !!g &&
    g.currentPlayerId === id &&
    !own?.eliminated &&
    !own?.forfeited &&
    ['turn', 'draw', 'penalty'].includes(g.phase) &&
    connection === 'live' &&
    !animation
  const choosing = g?.phase === 'draw'
  const cards = g?.hand.filter((c) => selected.includes(c.id)) ?? []
  function discard() {
    if (!g) return
    setSelectionError('')
    if (!cards.length || !cards.every((c) => c.rank === cards[0].rank)) {
      setSelectionError('Select one or more cards of the same rank.')
      return
    }
    if (move({ type: 'discard', cardIds: cards.map((c) => c.id) }))
      setSelected([])
  }
  function draw(source: 'pile' | 'discard', cardId?: string) {
    if (move({ type: 'draw', source, cardId })) setSelected([])
  }
  const ready = yours && (choosing || g?.phase === 'draw')
  const seconds =
    g?.deadline === null
      ? null
      : Math.max(0, Math.ceil(((g?.deadline ?? now) - now) / 1000))
  const final = !!g && ['round-over', 'game-over'].includes(g.phase)
  return (
    <section
      data-room-state={g ? 'playing' : 'lobby'}
      data-hand-count={g?.hand.length}
      className={`room-page ${g ? 'active-game' : 'lobby-page'} ${animation ? 'turn-in-motion' : ''} ${animation?.outgoing.length ? 'turn-discard-in-motion' : ''}`}
    >
      {room.hostTransfer?.fromId === id && <HostTransferDialog key={room.hostTransfer.id} room={room} now={now} busy={busy} live={connection === 'live'} error={error} send={send} />}
      <GameNotices events={g?.events ?? []} now={now} hostName={room.hostChange && room.hostChange.playerId === room.hostId && now - room.hostChange.at < 8000 ? room.members.find(member => member.id === room.hostId) && playerFirstName(room.members.find(member => member.id === room.hostId)!) : undefined} />
      <div className="room-heading">
        <div>
          <p className="eyebrow">
            {g ? 'ONLINE CARD TABLE' : 'YOUR FRIENDS. YOUR TABLE.'}
          </p>
          <h1>{g ? `Round ${g.round}` : 'Waiting lobby'}</h1>
        </div>
        <div
          className={`connection-pill connection-${connection}`}
          role="status"
        >
          {connection === 'live'
            ? 'Connected'
            : connection === 'error'
              ? 'Connection needs attention'
              : 'Reconnecting…'}
        </div>
      </div>
      {g && (
        <MobileGameBar
          round={g.round}
          activeName={activeName}
          seconds={final ? null : seconds}
          joker={g.indicator}
          penalty={g.penalty}
          players={players}
          onQuit={quit}
        />
      )}

      {error && (
        <p className="game-alert" role="alert">
          {error}{' '}
          <button className="text-button" onClick={local.reconnect}>
            Reconnect
          </button>
        </p>
      )}
      {!g ? <RoomLobby room={room} id={id} live={connection === 'live'} busy={busy}
        send={send} start={() => void command('start')} share={share} /> : (
        <>
      <div className="room-code-panel">
        <div>
          <span>ROOM CODE</span>
          <strong>{room.code}</strong>
        </div>
        <button
          className="button button-secondary compact-button"
          onClick={share}
        >
          Share Invitation
        </button>
        <label className="invitation-url">
          Invitation URL
          <input
            readOnly
            value={invitation}
            onFocus={(e) => e.target.select()}
          />
        </label>
      </div>
      <div className="room-settings-summary">
        <span>
          {room.settings.maxPlayers} players ·{' '}
          {room.settings.maxPlayers <= 4 ? '1 deck' : '2 decks'}
        </span>
        <span>Elimination cutoff: {room.settings.eliminationThreshold}</span>
        <span>
          {room.settings.timedGame
            ? 'Timed · 45 seconds'
            : 'Untimed · no timeout forfeits'}
        </span>
      </div>

          <p className="field-hint">
            {g.career?.eligible
              ? 'Career game · verified players · server-confirmed XP'
              : 'Casual game · no permanent XP or career statistics'}
          </p>
          <div className="match-toolbar">
            <strong>
              {activeName}’s
              turn
            </strong>
          </div>
          <div className="gameplay-stage">
          <div className="game-table live-table">
            <div
              className="opponent-row"
              role="group"
              aria-label="Other players"
              tabIndex={0}
            >
              {g.players
                .filter((p) => p.id !== id)
                .map((p) => (
                  <OpponentSeat
                    key={p.id}
                    player={p}
                    count={p.cardCount}
                    score={p.score}
                    active={p.id === g.currentPlayerId && !final}
                    eliminated={p.eliminated}
                    forfeited={p.forfeited}
                    status={p.id === room.hostId ? 'Host' : p.accountType === 'guest' ? 'Guest' : 'Registered'}
                    timer={
                      !final && p.id === g.currentPlayerId ? (
                        <TurnTimer seconds={seconds} name={playerFirstName(p)} />
                      ) : null
                    }
                  />
                ))}
            </div>
            <div className="live-piles">
              <div className="sample-pile">
                <button
                  className="pile-button"
                  data-draw-source
                  disabled={!ready || busy}
                  aria-label="Draw one replacement card"
                  onClick={() => draw('pile')}
                >
                  <PlayingCard faceDown />
                </button>
                <span>Draw pile · {g.drawCount}</span>
              </div>
              <div className="sample-pile">
                <div
                  className={`discard-stack ${g.phase === 'penalty' ? 'power-card-active' : ''}`}
                  data-discard-target
                >
                  <PlayingCard card={g.latestDiscard.at(-1)} />
                </div>
                <span>Drop Pile</span>
              </div>
              <div className="sample-pile joker-indicator">
                <PlayingCard card={g.indicator} />
                <span>Round Joker · {g.indicator.rank}</span>
              </div>
            </div>
            <PlayerHand
              player={auth.user!.player}
              total={handTotal(g.hand, g.indicator.rank)}
              score={own?.score ?? 0}
              active={!final && g.currentPlayerId === id}
              timer={
                !final && g.currentPlayerId === id ? (
                  <TurnTimer
                    seconds={seconds}
                    name={own ? playerFirstName(own) : 'You'}
                  />
                ) : null
              }
              empty={
                own?.forfeited && !own.eliminated
                  ? 'You forfeited this round. You can play again next round.'
                  : own?.eliminated
                  ? 'Your hand was removed from play.'
                  : 'An empty hand is worth zero.'
              }
            >
              {g.hand.map((card, index) => (
                <button
                  className={`hand-card ${selected.includes(card.id) ? 'selected-card' : ''} ${animation?.incoming?.card.id === card.id ? 'incoming-card-placeholder' : ''}`}
                  data-hand-card={card.id}
                  key={card.id}
                  disabled={
                    !yours ||
                    busy ||
                    choosing ||
                    (g.phase !== 'turn' && g.phase !== 'penalty') ||
                    (g.phase === 'penalty' && card.rank !== '7')
                  }
                  aria-label={`${cardLabel(card)}, card ${index + 1}`}
                  aria-pressed={selected.includes(card.id)}
                  onClick={() => {
                    setSelectionError('')
                    setSelected((ids) => toggleHandCard(g.hand, ids, card))
                  }}
                >
                  <PlayingCard card={card} />
                </button>
              ))}
            </PlayerHand>
          </div>
          <TurnActions
            phase={g.phase}
            yours={yours}
            activeName={activeName}
            busy={busy}
            moving={!!animation}
            hand={g.hand}
            selected={cards}
            pickups={g.pickup}
            canDeclare={g.canShow}
            penalty={g.penalty}
            feedback={latestActionHint(g.events)}
            error={selectionError}
            onDrop={discard}
            onDraw={() => draw('pile')}
            onPickup={(id) => draw('discard', id)}
            onDeclare={() => {
              setSelected([])
              send({ type: 'show' })
            }}
            onPenalty={() => {
              setSelected([])
              send({ type: 'accept-penalty' })
            }}
            onSelectAll={() =>
              setSelected(
                g.hand
                  .filter((card) => card.rank === cards[0]?.rank)
                  .map((card) => card.id),
              )
            }
            onClear={() => setSelected([])}
          />
          </div>
          {g.result && (
            <section className="round-summary">
              <div className="result-intro"><h2>{resultTitle(players, g.result, g.phase === 'game-over')}</h2></div>
              <ResultScores players={players} result={g.result} final={g.phase === 'game-over'} quitters={room.quitters}/>
              <div className="result-actions">
                {error && <p role="alert">{error}</p>}
                {g.phase === 'game-over' ? <button className="button button-primary" disabled={busy || connection !== 'live' || room.returned?.includes(id)}
                  onClick={() => send({ type: 'return-lobby', matchId: room.matchId })}>{room.returned?.includes(id) ? 'Waiting for other players' : 'Return to Lobby'}</button> : <>
                  <p>{readyCount}/{required.length} Players Ready</p>
                  {host ? <button className="button button-primary" disabled={busy || connection !== 'live' || readyCount !== required.length}
                    onClick={() => send({ type: 'next-round', matchId: room.matchId, round: g.round })}>Start Round {g.round + 1}</button>
                    : required.includes(id) && <button className="button button-primary" disabled={busy || connection !== 'live' || readyPlayers.includes(id)}
                      onClick={() => send({ type: 'ready', matchId: room.matchId, round: g.round })}>{readyPlayers.includes(id) ? 'Ready ✓' : 'Next Round'}</button>}
                  <QuitGame onQuit={quit}/>
                </>}
              </div>
            </section>
          )}
          <div className="game-below-table">
            <section className="match-scores">
              <h2>Match scores</h2>
              <ul>
                {g.players.map((p) => (
                  <li key={p.id}>
                    <PlayerIdentity player={gameplayIdentity(p)} compact />
                    <strong>{p.score}</strong>
                    <small>{p.forfeited ? (p.eliminated ? 'Forfeited · Eliminated' : 'Forfeited') : p.eliminated ? 'Eliminated' : 'Active'}</small>
                  </li>
                ))}
              </ul>
            </section>
            <GameActivity events={g.events} />
          </div>
        </>
      )}
      {animation && (
        <TurnAnimation motion={animation} onComplete={finishMotion} />
      )}
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
      <dialog ref={invitationDialog} className="table-overlay invitation-dialog" aria-labelledby={invitationTitle}>
        <div className="table-overlay-shell">
          <header><h2 id={invitationTitle}>Share Invitation</h2><button className="text-button" onClick={() => invitationDialog.current?.close()}>Close</button></header>
          <div className="table-overlay-body">
            <p>{invitationFailed ? 'Sharing could not open. Copy the invitation below.' : 'Select and copy the invitation below.'}</p>
            <textarea aria-label="Invitation message" readOnly value={invitationMessage(code, invitation)} onFocus={event => event.target.select()} />
            {navigator.clipboard?.writeText && <button className="button button-primary" onClick={() => {
              void navigator.clipboard.writeText(invitationMessage(code, invitation)).then(() => {
                copiedInvitation(); invitationDialog.current?.close()
              }, () => setInvitationFailed(true))
            }}>Copy invitation</button>}
          </div>
        </div>
      </dialog>
      {!g && <div className="room-footer">
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            onExit()
            await command('leave')
          }}
        >
          Leave Room
        </button>
        {host && !g && (
          <button
            className="text-button danger-button"
            disabled={busy}
            onClick={() => {
              if (confirm('Close this waiting room for everyone?'))
                void command('close')
            }}
          >
            Close Room
          </button>
        )}
        <a className="text-link" href="#/rules">
          How to Play →
        </a>
      </div>}
      {g && !final && (
        <p className="field-hint">
          Leaving this screen does not pause an online turn. In untimed games,
          disconnected seats remain and there is no automatic timeout
          forfeit.
        </p>
      )}
    </section>
  )
}
