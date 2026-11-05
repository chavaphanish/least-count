import { discardOutcome } from '../game/engine'
import { GameActivity } from '../components/GameActivity'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRoom } from '../hooks/useRoom'
import { Avatar } from '../components/Avatar'
import { PlayingCard } from '../components/PlayingCard'
import { cardLabel, cardValue, handTotal } from '../game/deck'
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
  const id = auth.user!.player.id
  const [selected, setSelected] = useState<string[]>([])
  const [plan, setPlan] = useState<number | null>(null)
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
          title: 'Least Count',
          text: `Join my Least Count room: ${code}`,
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
      <section className="room-page">
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
            Back to dashboard
          </button>
        </div>
      </section>
    )
  const host = room.hostId === id
  const connected = room.members.filter((m) => m.connected && !m.left).length
  const full =
    room.members.length === room.settings.maxPlayers &&
    connected === room.settings.maxPlayers
  const g = room.game
  const own = g?.players.find((p) => p.id === id)
  const yours =
    !!g &&
    g.currentPlayerId === id &&
    !own?.eliminated &&
    ['turn', 'draw', 'penalty'].includes(g.phase) &&
    connection === 'live'
  const choosing = plan === room.revision
  const cards = g?.hand.filter((c) => selected.includes(c.id)) ?? []
  const matching =
    !!cards.length &&
    cards.every((c) => c.rank === g?.latestDiscard.at(-1)?.rank)
  function discard() {
    if (!g) return
    setSelectionError('')
    if (!cards.length || !cards.every((c) => c.rank === cards[0].rank)) {
      setSelectionError('Select one or more cards of the same rank.')
      return
    }
    const outcome = discardOutcome(
      g.phase,
      cards[0].rank,
      g.latestDiscard.at(-1)?.rank,
      g.pickup.length > 0,
    )
    if (outcome !== 'choice') {
      if (send({ type: 'discard', cardIds: cards.map((c) => c.id) }))
        setSelected([])
    } else setPlan(room!.revision)
  }
  function draw(source: 'pile' | 'discard', cardId?: string) {
    if (!g) return
    const accepted = send(
      choosing
        ? { type: 'play-turn', cardIds: cards.map((c) => c.id), source, cardId }
        : { type: 'draw', source, cardId },
    )
    if (accepted) {
      setSelected([])
      setPlan(null)
    }
  }
  const ready = yours && (choosing || g?.phase === 'draw')
  const seconds =
    g?.deadline === null
      ? null
      : Math.max(0, Math.ceil(((g?.deadline ?? now) - now) / 1000))
  const final = !!g && ['round-over', 'game-over'].includes(g.phase)
  return (
    <section className="room-page">
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
            : 'Untimed · no timeout elimination'}
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
              >
                <Avatar player={m} />
                <h3>
                  {m.displayName}
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
                  {full
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
          <div className="match-toolbar">
            <strong>
              {g.players.find((p) => p.id === g.currentPlayerId)?.displayName}’s
              turn
            </strong>
            {!final &&
              (seconds === null ? (
                <span className="preview-pill">UNTIMED</span>
              ) : (
                <div
                  className={`turn-clock ${seconds <= 10 ? 'clock-urgent' : ''}`}
                  role="timer"
                  aria-label={`${seconds} seconds remaining`}
                >
                  <strong>{seconds}s</strong>
                  <span>Server clock</span>
                </div>
              ))}
          </div>
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
                  <div
                    className={`live-opponent ${p.id === g.currentPlayerId && !final ? 'active-seat' : ''}`}
                    key={p.id}
                  >
                    <Avatar player={p} />
                    <strong>{p.displayName}</strong>
                    <span>
                      {p.eliminated ? 'Eliminated' : `${p.cardCount} cards`} ·{' '}
                      {p.score} pts
                    </span>
                    <small>
                      {p.accountType === 'guest' ? 'Guest' : 'Registered'}
                    </small>
                    {!p.eliminated && (
                      <div className="opponent-cards" aria-hidden="true">
                        {Array.from(
                          { length: Math.min(3, p.cardCount) },
                          (_, i) => (
                            <PlayingCard faceDown key={i} />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <div className="live-piles">
              <div className="sample-pile">
                <button
                  className="pile-button"
                  disabled={!ready || busy}
                  aria-label="Draw one replacement card"
                  onClick={() => draw('pile')}
                >
                  <PlayingCard faceDown />
                </button>
                <span>Draw pile · {g.drawCount}</span>
              </div>
              <div className="sample-pile">
                <PlayingCard card={g.latestDiscard.at(-1)} />
                <span>Latest discard</span>
              </div>
              <div className="sample-pile joker-indicator">
                <PlayingCard card={g.indicator} />
                <span>Selected Joker · {g.indicator.rank}</span>
              </div>
            </div>
            <div className="your-live-seat">
              <div className="hand-heading">
                <h2>Your hand</h2>
                <strong>{handTotal(g.hand, g.indicator.rank)} points</strong>
                <span>
                  {g.hand.length} cards · {own?.score} cumulative
                </span>
              </div>
              <div className="player-hand" role="group" aria-label="Your hand">
                {g.hand.map((card, index) => (
                  <button
                    className={`hand-card ${selected.includes(card.id) ? 'selected-card' : ''}`}
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
                      setSelected((ids) =>
                        ids.includes(card.id)
                          ? ids.filter((value) => value !== card.id)
                          : [...ids, card.id],
                      )
                    }}
                  >
                    <PlayingCard card={card} />
                    <span className="card-value">
                      {cardValue(card, g.indicator.rank)} pts
                    </span>
                  </button>
                ))}
                {!g.hand.length && (
                  <p className="empty-hand">
                    {own?.eliminated
                      ? 'Your hand was removed from play.'
                      : 'An empty hand is worth zero.'}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="turn-panel">
            <p className="turn-message" role="status">
              {final
                ? 'Review the round results below.'
                : !yours
                  ? 'Waiting for the current player.'
                  : g.phase === 'penalty'
                    ? `Respond with 7s or draw ${g.penalty} cards.`
                    : choosing
                      ? 'Your cards are not discarded yet. Choose a replacement source to commit both actions.'
                      : g.hand.length
                        ? 'Select cards of one rank, or call Show when eligible.'
                        : 'Your hand is empty: call Show on this normal turn.'}
            </p>
            {selectionError && (
              <p className="game-alert" role="alert">
                {selectionError}
              </p>
            )}
            {yours && (
              <div className="turn-actions">
                {!choosing && (g.phase === 'turn' || g.phase === 'penalty') && (
                  <button
                    className="button button-primary"
                    disabled={busy || !cards.length}
                    onClick={discard}
                  >
                    {g.phase === 'penalty' || cards[0]?.rank === '7'
                      ? 'Play selected 7s'
                      : matching
                        ? 'Match & Drop'
                        : g.pickup.length
                          ? 'Choose draw source'
                          : 'Discard & draw automatically'}
                  </button>
                )}
                {g.phase === 'turn' && !choosing && (
                  <button
                    className="button button-secondary"
                    disabled={busy || !g.canShow}
                    onClick={() => send({ type: 'show' })}
                  >
                    Call Show
                  </button>
                )}
                {ready && (
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => draw('pile')}
                  >
                    Draw from pile
                  </button>
                )}
                {g.phase === 'penalty' && (
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => send({ type: 'accept-penalty' })}
                  >
                    Draw {g.penalty} penalty cards
                  </button>
                )}
                {choosing && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setPlan(null)}
                  >
                    Back to selection
                  </button>
                )}
              </div>
            )}
            {ready && (
              <div className="pickup-panel">
                <h3>Previous player’s eligible discard group</h3>
                {g.pickup.length ? (
                  <div className="pickup-cards">
                    {g.pickup.map((card) => (
                      <button
                        className="pickup-button"
                        key={card.id}
                        disabled={busy}
                        aria-label={`Pick up ${cardLabel(card)}`}
                        onClick={() => draw('discard', card.id)}
                      >
                        <PlayingCard card={card} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>No group is eligible. Draw from the pile.</p>
                )}
              </div>
            )}
          </div>
          {g.result && (
            <section className="round-summary">
              <h2>
                {g.phase === 'game-over'
                  ? `${g.players.find((p) => !p.eliminated)?.displayName} wins the match!`
                  : 'Round complete'}
              </h2>
              <p>
                Only totals are shared. Opponents’ individual cards remain
                private.
              </p>
              {!!g.result.scores.length && (
                <div className="score-scroll">
                  <table className="score-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Hand</th>
                        <th>Penalty</th>
                        <th>Cumulative</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.result.scores.map((p) => (
                        <tr key={p.id}>
                          <th>{p.name}</th>
                          <td>{p.total}</td>
                          <td>+{p.penalty}</td>
                          <td>{p.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
            </section>
          )}
          <div className="game-below-table">
            <section className="match-scores">
              <h2>Match scores</h2>
              <ul>
                {g.players.map((p) => (
                  <li key={p.id}>
                    <span>{p.displayName}</span>
                    <strong>{p.score}</strong>
                    <small>{p.eliminated ? 'Eliminated' : 'Active'}</small>
                  </li>
                ))}
              </ul>
            </section>
            <GameActivity events={g.events} />
          </div>
        </>
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
          elimination.
        </p>
      )}
    </section>
  )
}
