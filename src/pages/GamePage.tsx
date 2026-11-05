import { useEffect, useState } from 'react'
import { PlayingCard } from '../components/PlayingCard'
import { RoundSummary } from '../components/RoundSummary'
import { cardLabel, cardValue, handTotal } from '../game/deck'
import { canShow, isPlaying, latestGroup, pickupCards } from '../game/engine'
import type { useLocalGame } from '../hooks/useLocalGame'

export function GamePage({
  local,
}: {
  local: ReturnType<typeof useLocalGame>
}) {
  const { game, now, error, canSave, send, start, reset } = local
  const [count, setCount] = useState(4)
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    if (game?.phase === 'round-over' || game?.phase === 'game-over') {
      document.getElementById('round-result')?.focus()
    }
  }, [game?.phase])
  const newGame = () => {
    if (
      !game ||
      !isPlaying(game) ||
      window.confirm(
        'End this local match and set up a new game? Your current progress will be replaced.',
      )
    ) {
      setSelected([])
      reset()
    }
  }
  const header = (
    <>
      <a href="#/" className="text-link back-link">
        ← Back to the lounge
      </a>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR OWN LITTLE CARD NIGHT</p>
          <h1 id="game-title">
            A place at the <em>table.</em>
          </h1>
        </div>
        <span className="preview-pill">
          <span className="status-dot" /> LOCAL PRACTICE
        </span>
      </div>
      <p className="preview-notice">
        Practice with simulated opponents on this device. All hands and timers
        run locally; online play is not available.
      </p>
    </>
  )
  if (!game)
    return (
      <section className="game-page" aria-labelledby="game-title">
        {header}
        <div className="game-setup">
          <div className="setup-mark" aria-hidden="true">
            ♠
          </div>
          <p className="eyebrow">A FRESH DECK. A NEW BEGINNING.</p>
          <h2>Pull up a chair.</h2>
          <p>
            Seven cards each. Keep your count low. Call Show at five or less,
            and stay below 100 points.
          </p>
          <label htmlFor="player-count">Players at the table</label>
          <select
            id="player-count"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          >
            {Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} players · you + {n - 1} simulated{' '}
                {n === 2 ? 'opponent' : 'opponents'}
              </option>
            ))}
          </select>
          <p className="setup-detail">
            {count <= 4
              ? 'One deck + one Printed Joker'
              : 'Two decks + two Printed Jokers'}{' '}
            · 60 seconds per turn
          </p>
          <button
            className="button button-primary"
            onClick={() => {
              setSelected([])
              start(count)
            }}
          >
            Start local game <span aria-hidden="true">→</span>
          </button>
          <a className="text-link" href="#/rules">
            Read the rules first →
          </a>
          <p className="setup-saving">
            Progress is saved in this browser tab. Turn deadlines continue
            through refreshes.
          </p>
        </div>
      </section>
    )

  const human = game.players[0]
  const current = game.players[game.current]
  const playing = isPlaying(game)
  const yours = playing && game.current === 0 && !human.eliminated
  const canSelect = yours && (game.phase === 'turn' || game.phase === 'penalty')
  const seconds = Math.max(0, Math.ceil(((game.deadline ?? now) - now) / 1000))
  const group = latestGroup(game)
  const pickups = pickupCards(game)
  const selectedCards = human.hand.filter((c) => selected.includes(c.id))
  const discardSelected = () => {
    if (
      send({
        type: 'discard',
        playerId: human.id,
        cardIds: selectedCards.map((c) => c.id),
      })
    )
      setSelected([])
  }
  const message = !playing
    ? 'Round complete. Review the results below.'
    : human.eliminated
      ? `You were eliminated by ${human.eliminationReason}. You can watch the remaining local players.`
      : !yours
        ? `${current.name} is thinking…`
        : game.phase === 'draw'
          ? 'Choose one replacement card below or draw from the pile.'
          : game.phase === 'penalty'
            ? `Play one or more 7s, or draw ${game.sevens!.amount} penalty cards and lose your normal turn.`
            : !human.hand.length
              ? 'Your hand is empty. You must call Show now; passing is not allowed.'
              : 'Select one card or a group of the same rank, then discard. You may call Show before discarding if your total is 5 or less.'

  return (
    <section className="game-page active-game" aria-labelledby="game-title">
      {header}
      {!canSave && (
        <p className="game-alert" role="status">
          Browser storage is unavailable. Refreshing will lose this match.
        </p>
      )}
      <div className="match-toolbar">
        <div>
          <strong>Round {game.round}</strong>
          <span>
            {game.players.filter((p) => !p.eliminated).length} active · cutoff
            100
          </span>
        </div>
        {playing && (
          <div
            className={`turn-clock ${seconds <= 10 ? 'clock-urgent' : ''}`}
            role="timer"
            aria-label={`${current.name}'s turn: ${seconds} seconds remaining`}
          >
            <span>{yours ? 'Your turn' : `${current.name}'s turn`}</span>
            <strong>{seconds}s</strong>
          </div>
        )}
        <button
          className="button button-secondary compact-button"
          onClick={newGame}
        >
          New game
        </button>
      </div>
      <div className="game-table live-table" aria-label="Local card table">
        <p className="seat-scroll-hint">
          Simulated opponents · scroll to see all seats
        </p>
        <div
          className="opponent-row"
          tabIndex={0}
          role="group"
          aria-label="Simulated opponents; scroll horizontally to see all seats"
        >
          {game.players.slice(1).map((player, index) => (
            <div
              className={`live-opponent ${game.current === index + 1 && playing ? 'active-seat' : ''} ${player.eliminated ? 'eliminated-seat' : ''}`}
              key={player.id}
            >
              <div className="avatar" aria-hidden="true">
                {player.name[0]}
              </div>
              <strong>{player.name}</strong>
              <span>
                {player.eliminated
                  ? `Out · ${player.eliminationReason}`
                  : `${player.hand.length} cards · ${player.score} pts`}
              </span>
              <small>
                {game.current === index + 1 && playing
                  ? 'Taking a turn'
                  : player.eliminated
                    ? `Final score: ${player.score}`
                    : 'Simulated opponent'}
              </small>
              {!player.eliminated && (
                <div className="opponent-cards" aria-hidden="true">
                  {Array.from(
                    { length: Math.min(3, player.hand.length) },
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
              disabled={!yours || game.phase !== 'draw'}
              aria-label="Draw one replacement card"
              onClick={() =>
                send({ type: 'draw', playerId: human.id, source: 'pile' })
              }
            >
              <PlayingCard faceDown />
            </button>
            <span>Draw pile · {game.drawPile.length}</span>
          </div>
          <div className="sample-pile">
            <PlayingCard card={group.at(-1)} />
            <span>Latest discard · {group.length}</span>
          </div>
          <div className="sample-pile joker-indicator">
            <PlayingCard card={game.indicator} />
            <span>Selected Joker · {game.indicator.rank}</span>
            <small>This rank is worth 0</small>
          </div>
        </div>
        <div className="your-live-seat">
          <div className="hand-heading">
            <h2>Your hand</h2>
            <strong data-testid="hand-total">
              {handTotal(human.hand, game.indicator.rank)} points
            </strong>
            <span>
              {human.hand.length} cards · {human.score} cumulative
            </span>
          </div>
          <div className="player-hand" role="group" aria-label="Your hand">
            {human.hand.map((card, index) => (
              <button
                className={`hand-card ${selected.includes(card.id) ? 'selected-card' : ''}`}
                key={card.id}
                disabled={
                  !canSelect || (game.phase === 'penalty' && card.rank !== '7')
                }
                aria-label={`${cardLabel(card)}, ${cardValue(card, game.indicator.rank)} points, card ${index + 1}`}
                aria-pressed={selected.includes(card.id)}
                onClick={() =>
                  setSelected((ids) =>
                    ids.includes(card.id)
                      ? ids.filter((id) => id !== card.id)
                      : [...ids, card.id],
                  )
                }
              >
                <PlayingCard card={card} />
                <span className="card-value">
                  {cardValue(card, game.indicator.rank)} pts
                </span>
              </button>
            ))}
            {!human.hand.length && (
              <p className="empty-hand">
                {human.eliminated
                  ? 'Your cards have been removed from play.'
                  : 'An empty hand is worth zero.'}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="turn-panel">
        <p className="turn-message" role="status">
          {message}
        </p>
        {error && (
          <p role="alert" className="game-alert">
            {error}
          </p>
        )}
        {yours && (
          <div className="turn-actions">
            {(game.phase === 'turn' || game.phase === 'penalty') && (
              <button
                className="button button-primary"
                disabled={!selectedCards.length}
                onClick={discardSelected}
              >
                {game.phase === 'penalty'
                  ? 'Play selected 7s'
                  : 'Discard selected'}
                {selectedCards.length ? ` (${selectedCards.length})` : ''}
              </button>
            )}
            {game.phase === 'turn' && (
              <button
                className="button button-secondary"
                disabled={!canShow(game, human.id)}
                onClick={() => {
                  setSelected([])
                  send({ type: 'show', playerId: human.id })
                }}
              >
                Call Show
              </button>
            )}
            {game.phase === 'draw' && (
              <button
                className="button button-primary"
                onClick={() =>
                  send({ type: 'draw', playerId: human.id, source: 'pile' })
                }
              >
                Draw from pile
              </button>
            )}
            {game.phase === 'penalty' && (
              <button
                className="button button-secondary"
                onClick={() => {
                  setSelected([])
                  send({ type: 'accept-penalty', playerId: human.id })
                }}
              >
                Draw {game.sevens!.amount} penalty cards
              </button>
            )}
            {!!selectedCards.length && canSelect && (
              <button className="text-button" onClick={() => setSelected([])}>
                Clear selection
              </button>
            )}
          </div>
        )}
        {yours && game.phase === 'draw' && (
          <div className="pickup-panel">
            <h3>Previous player’s eligible discard group</h3>
            {pickups.length ? (
              <>
                <p>
                  Take exactly one of these cards instead of drawing from the
                  pile.
                </p>
                <div className="pickup-cards">
                  {pickups.map((card) => (
                    <button
                      className="pickup-button"
                      key={card.id}
                      aria-label={`Pick up ${cardLabel(card)}`}
                      onClick={() =>
                        send({
                          type: 'draw',
                          playerId: human.id,
                          source: 'discard',
                          cardId: card.id,
                        })
                      }
                    >
                      <PlayingCard card={card} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>No group is eligible. You must draw from the draw pile.</p>
            )}
          </div>
        )}
      </div>
      {game.result && (
        <RoundSummary
          game={game}
          nextRound={() => {
            setSelected([])
            send({ type: 'next-round' })
          }}
          newGame={newGame}
        />
      )}
      <div className="game-below-table">
        <section className="match-scores" aria-labelledby="match-scores-title">
          <h2 id="match-scores-title">Match scores</h2>
          <ul>
            {game.players.map((player) => (
              <li key={player.id}>
                <span>{player.name}</span>
                <strong>{player.score}</strong>
                <small>
                  {player.eliminated
                    ? `Out · ${player.eliminationReason}`
                    : 'Active'}
                </small>
              </li>
            ))}
          </ul>
        </section>
        <details className="activity-log">
          <summary>Table activity</summary>
          <ol>
            {game.log.slice(-10).map((entry, index) => (
              <li key={`${game.log.length}-${index}`}>{entry}</li>
            ))}
          </ol>
        </details>
      </div>
      <div className="table-footnote">
        <span>
          Saved in this tab. The turn clock continues through navigation and
          refreshes.
        </span>
        <a className="text-link" href="#/rules">
          Read the rules →
        </a>
      </div>
    </section>
  )
}
