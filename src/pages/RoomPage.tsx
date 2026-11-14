import { GameNotices } from '../components/GameNotices'
import { HostTransferDialog } from '../components/HostTransferDialog'
import { useGameFeedback } from '../feedback/FeedbackProvider'
import { useGameplayLoading } from '../components/NavigationLoading'
import { ResultScores } from '../components/ResultScores'
import { MobileGameBar } from '../components/MobileGameBar'
import { OpponentSeat } from '../components/OpponentSeat'
import { CareerRewards } from '../career/CareerRewards'
import { useActiveSeat } from '../hooks/useActiveSeat'
import { TurnActions } from '../components/TurnActions'
import { TurnTimer } from '../components/TurnTimer'
import { latestActionHint, toggleHandCard } from '../lib/handSelection'
import { PlayerHand } from '../components/PlayerHand'
import { TurnAnimation } from '../components/TurnAnimation'
import { useRoomCardMotion } from '../hooks/useRoomCardMotion'
import { GameActivity } from '../components/GameActivity'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRoom } from '../hooks/useRoom'
import { gameplayIdentity, playerFirstName } from '../shared/playerIdentity'
import { PlayerIdentity } from '../components/PlayerIdentity'
import { Avatar } from '../components/Avatar'
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
  const { room, connection, error, busy, now, send, command } = local
  useGameplayLoading(!!room?.game)
  useGameFeedback(room?.game ? {scope:`room:${room.id}`,revision:room.revision,round:room.game.round,phase:room.game.phase,dropIds:room.game.latestDiscard.map(c=>c.id).join(','),localId:auth.user!.player.id,currentId:room.game.currentPlayerId,players:room.game.players,events:room.game.events,deadline:room.game.deadline,now,connected:connection==='live',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches} : null)
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
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Copied to clipboard.')
    } catch {
      setNotice(
        'Copy is unavailable. Select the code or invitation URL and copy it manually.',
      )
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'YAYDU',
          text: `Join my YAYDU room: ${code}`,
          url: invitation,
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          await copy(invitation)
      }
    } else await copy(invitation)
  }
  if (!room)
    return (
      <section
        className={`room-page ${animation ? 'turn-in-motion' : ''} ${animation?.outgoing.length ? 'turn-discard-in-motion' : ''}`}
      >
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
  const connected = room.members.filter((m) => m.connected && !m.left).length
  const full =
    room.members.length === room.settings.maxPlayers &&
    connected === room.settings.maxPlayers
  const g = room.game
  const own = g?.players.find((p) => p.id === id)
  const current = g?.players.find((p) => p.id === g.currentPlayerId)
  const activeName = current ? playerFirstName(current) : 'the active player'
  const winner = g?.players.find((p) => !p.eliminated)
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
      className={`room-page ${g ? 'active-game' : ''} ${animation ? 'turn-in-motion' : ''} ${animation?.outgoing.length ? 'turn-discard-in-motion' : ''}`}
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
          players={g.players.map((p) => ({
            id: p.id,
            name: playerFirstName(p),
            score: p.score,
            eliminated: p.eliminated,
            forfeited: p.forfeited,
          }))}
        >
          <p>
            Host: {room.members.find(member => member.id === room.hostId) ? playerFirstName(room.members.find(member => member.id === room.hostId)!) : 'Waiting for an active player'} · Room {code} · cutoff {room.settings.eliminationThreshold} ·{' '}
            {connection === 'live'
              ? 'Connected'
              : connection === 'error'
                ? 'Connection needs attention'
                : 'Reconnecting…'}
          </p>
          <button className="text-button" onClick={() => copy(code)}>
            Copy Code
          </button>
          <button className="text-button" onClick={share}>
            Share Invitation
          </button>
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
          <a className="text-link" href="#/rules">
            How to Play →
          </a>
        </MobileGameBar>
      )}

      {error && (
        <p className="game-alert" role="alert">
          {error}{' '}
          <button className="text-button" onClick={local.reconnect}>
            Reconnect
          </button>
        </p>
      )}
      <div className="room-code-panel">
        <div>
          <span>ROOM CODE</span>
          <strong>{room.code}</strong>
        </div>
        <button
          className="button button-secondary compact-button"
          onClick={() => copy(code)}
        >
          Copy Code
        </button>
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
            ? 'Timed · 60 seconds'
            : 'Untimed · no timeout forfeits'}
        </span>
      </div>
      {!g ? (
        <>
          <div className="lobby-count">
            <h2>
              {connected} connected · {room.members.length} of{' '}
              {room.settings.maxPlayers} seats reserved
            </h2>
            <p>
              {room.settings.maxPlayers - room.members.length} available seats
            </p>
          </div>
          <div className="lobby-grid">
            {room.members.map((m) => (
              <article
                className={`lobby-player ${!m.connected ? 'disconnected-player' : ''}`}
                key={m.id}
                data-host={m.id === room.hostId}
                data-connected={m.connected}
              >
                <Avatar player={m} />
                <h3>
                  <PlayerIdentity player={gameplayIdentity(m)} compact />
                  {m.id === id ? ' (You)' : ''}
                </h3>
                <span className="account-badge">
                  {m.accountType === 'guest' ? 'Guest' : 'Registered'}
                  {m.id === room.hostId ? ' · Host' : ''}
                </span>
                <p>
                  {m.connected ? 'Connected' : 'Reconnecting · seat reserved'}
                </p>
              </article>
            ))}
            {Array.from(
              {
                length: Math.max(
                  0,
                  room.settings.maxPlayers - room.members.length,
                ),
              },
              (_, i) => (
                <article className="lobby-player empty-seat" key={`seat-${i}`}>
                  <span aria-hidden="true">♧</span>
                  <h3>Waiting for player…</h3>
                  <p>Share the code to fill this seat.</p>
                </article>
              ),
            )}
          </div>
          <div className="lobby-start">
            {host ? (
              <>
                <p role="status">
                  {connection !== 'live'
                    ? 'Reconnect to start the game.'
                    : full
                      ? 'All players have joined. Ready when you are.'
                      : 'Waiting for every configured seat to be filled and connected.'}
                </p>
                <button
                  className="button button-primary"
                  disabled={!full || busy || connection !== 'live'}
                  onClick={() => command('start')}
                >
                  Start Game
                </button>
              </>
            ) : (
              <p role="status">
                {full
                  ? 'Waiting for host to start'
                  : `Waiting for ${room.settings.maxPlayers - connected} more connected players`}
              </p>
            )}
          </div>
          <p className="field-hint">
            The host starts manually. Temporary disconnects reserve a lobby seat
            for 90 seconds after detection; returning with the same identity
            restores that seat. Only connected, valid seats can start.
          </p>
        </>
      ) : (
        <>
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
              <div className="result-intro">
                {g.career?.eligible && (
                  <CareerRewards
                    key={g.round}
                    game={g.career.gameId}
                    round={g.round}
                  />
                )}
                <h2>
                  {g.phase === 'game-over'
                    ? `${winner ? playerFirstName(winner) : 'The remaining player'} wins the match!`
                    : g.result.reason === 'show'
                      ? g.result.successful
                        ? 'Least successful!'
                        : 'Least failed!'
                      : 'Round complete'}
                </h2>
                {g.result.reason === 'show' && (
                  <p>
                    {g.result.successful
                      ? 'The lowest hand wins; zero-point ties share the win.'
                      : 'A 40-point penalty was applied to the unsuccessful declaration.'}
                  </p>
                )}
                <p>
                  Only totals are shared. Opponents’ individual cards remain
                  private.
                </p>
              </div>
              {!!g.result.scores.length && (
                <ResultScores
                  scores={g.result.scores}
                  round={g.round}
                  winners={g.result.winners}
                />
              )}
              <div className="result-actions">
                {g.phase === 'round-over' &&
                  (host ? (
                    <button
                      className="button button-primary"
                      disabled={busy || connection !== 'live'}
                      onClick={() => send({ type: 'next-round' })}
                    >
                      Start round {g.round + 1}
                    </button>
                  ) : (
                    <p>Waiting for the host to start the next round.</p>
                  ))}
                {final && (
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={async () => {
                      onExit()
                      await command('leave')
                    }}
                  >
                    Leave Room
                  </button>
                )}
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
      <div className="room-footer">
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
      </div>
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
