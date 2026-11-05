import { gameEvents } from '../game/events'
import { GameActivity } from '../components/GameActivity'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayingCard } from '../components/PlayingCard'
import { RoundSummary } from '../components/RoundSummary'
import { cardLabel, cardValue, handTotal } from '../game/deck'
import {
  canShow,
  inspectDiscard,
  isPlaying,
  latestGroup,
  pickupCards,
} from '../game/engine'
import type { Action, GameState } from '../game/engine'
import type { GameCard } from '../game/deck'
import { TurnAnimation, cardRect } from '../components/TurnAnimation'
import type { CardDeparture, TurnMotion } from '../components/TurnAnimation'
import type { useLocalGame } from '../hooks/useLocalGame'

export function GamePage({
  local,
}: {
  local: ReturnType<typeof useLocalGame>
}) {
  const { game, now, error, canSave, send, start, reset } = local
  const [count, setCount] = useState(4)
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState<{
    game: GameState
    cardIds: string[]
  } | null>(null)
  const [motion, setMotion] = useState<
    (TurnMotion & { game: GameState; previousGroup: GameCard[] }) | null
  >(null)
  const [selectionError, setSelectionError] = useState('')
  const finishMotion = useCallback(() => setMotion(null), [])
  const animation = motion?.game === game ? motion : null
  const choosing = !!pending && pending.game === game
  const visibleError = selectionError || error
  const wasChoosing = useRef(false)
  useEffect(() => {
    if (choosing)
      document
        .querySelector<HTMLButtonElement>('[data-primary-draw]')
        ?.focus({ preventScroll: true })
    else if (wasChoosing.current && !animation)
      document
        .querySelector<HTMLButtonElement>('[data-plan-discard]')
        ?.focus({ preventScroll: true })
    wasChoosing.current = choosing
  }, [choosing, animation])
  useEffect(() => {
    if (
      !animation &&
      (game?.phase === 'round-over' || game?.phase === 'game-over')
    ) {
      document.getElementById('round-result')?.focus()
    }
  }, [game?.phase, animation])
  const newGame = () => {
    if (
      !game ||
      !isPlaying(game) ||
      window.confirm(
        'End this local match and set up a new game? Your current progress will be replaced.',
      )
    ) {
      setSelected([])
      setPending(null)
      setMotion(null)
      setSelectionError('')
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
  const yours = playing && game.current === 0 && !human.eliminated && !animation
  const canSelect =
    yours && !choosing && (game.phase === 'turn' || game.phase === 'penalty')
  const readyToDraw = yours && (choosing || game.phase === 'draw')
  const seconds = Math.max(0, Math.ceil(((game.deadline ?? now) - now) / 1000))
  const group = latestGroup(game)
  const pickups = pickupCards(game)
  const selectedCards = human.hand.filter((c) => selected.includes(c.id))
  const matchesTop =
    selectedCards.length > 0 &&
    selectedCards.every((card) => card.rank === group.at(-1)?.rank)
  const elementFor = (attribute: string, id: string) =>
    Array.from(document.querySelectorAll(`[${attribute}]`))
      .find((element) => element.getAttribute(attribute) === id)
      ?.querySelector('.playing-card') ?? null
  const executeMove = (action: Action) => {
    if (animation) return
    const outgoing: CardDeparture[] =
      action.type === 'discard' || action.type === 'play-turn'
        ? human.hand
            .filter((card) => action.cardIds.includes(card.id))
            .flatMap((card) => {
              const from = cardRect(elementFor('data-hand-card', card.id))
              return from ? [{ card, from }] : []
            })
        : []
    const source =
      action.type === 'draw' || action.type === 'play-turn'
        ? action.source
        : action.type === 'discard' &&
            inspectDiscard(game, human.id, action.cardIds).outcome ===
              'automatic'
          ? 'pile'
          : null
    const incomingFrom =
      source === 'pile'
        ? cardRect(document.querySelector('[data-draw-source] .playing-card'))
        : (action.type === 'draw' || action.type === 'play-turn') &&
            action.cardId
          ? (cardRect(elementFor('data-discard-card', action.cardId)) ??
            (choosing
              ? cardRect(
                  document.querySelector('[data-discard-target] .playing-card'),
                )
              : null) ??
            cardRect(elementFor('data-pickup-card', action.cardId)))
          : null
    const next = send(action)
    if (!next) return
    setSelected([])
    setPending(null)
    setSelectionError('')
    // The reducer may resolve an expired turn instead of accepting this action.
    const discarded = outgoing.filter((departure) =>
      next.discards.flat().some((card) => card.id === departure.card.id),
    )
    const incoming =
      source && incomingFrom
        ? next.players[0].hand.find(
            (card) => !human.hand.some((before) => before.id === card.id),
          )
        : undefined
    if (
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      (discarded.length || incoming)
    ) {
      setMotion({
        game: next,
        previousGroup: group,
        outgoing: discarded,
        incoming:
          incoming && incomingFrom
            ? {
                card: incoming,
                from: incomingFrom,
                faceDown: source === 'pile',
              }
            : undefined,
      })
    }
  }
  const discardSelected = () => {
    setSelectionError('')
    try {
      const ids = selectedCards.map((card) => card.id)
      if (inspectDiscard(game, human.id, ids).needsChoice)
        setPending({ game, cardIds: ids })
      else executeMove({ type: 'discard', playerId: human.id, cardIds: ids })
    } catch (reason) {
      setSelectionError(
        reason instanceof Error ? reason.message : 'Check your selection.',
      )
    }
  }
  const chooseDraw = (source: 'pile' | 'discard', cardId?: string) => {
    if (!readyToDraw) return
    executeMove(
      choosing && pending
        ? {
            type: 'play-turn',
            playerId: human.id,
            cardIds: pending.cardIds,
            source,
            cardId,
          }
        : { type: 'draw', playerId: human.id, source, cardId },
    )
  }
  const message = animation
    ? 'Moving your cards… Discard and pickup resolve together.'
    : !playing
      ? 'Round complete. Review the results below.'
      : human.eliminated
        ? `You were eliminated by ${human.eliminationReason}. You can watch the remaining local players.`
        : !yours
          ? `${current.name} is thinking…`
          : choosing
            ? 'Your cards are selected, not discarded yet. Choose a draw source to complete both actions, or go back to change your selection.'
            : game.phase === 'draw'
              ? 'Choose one replacement card below or draw from the pile.'
              : game.phase === 'penalty'
                ? `Play one or more 7s, or draw ${game.sevens!.amount} penalty cards and lose your normal turn.`
                : !human.hand.length
                  ? 'Your hand is empty. You must call Show now; passing is not allowed.'
                  : 'Select one card or a group of the same rank, then choose your draw source. Matching the top rank skips the draw. Show is available before discarding at 5 or less.'

  return (
    <section
      className={`game-page active-game ${animation ? 'turn-in-motion' : ''} ${animation?.outgoing.length ? 'turn-discard-in-motion' : ''}`}
      aria-labelledby="game-title"
    >
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
          disabled={!!animation}
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
              data-draw-source
              disabled={!readyToDraw}
              aria-label="Draw one replacement card"
              onClick={() => chooseDraw('pile')}
            >
              <PlayingCard faceDown />
            </button>
            <span>Draw pile · {game.drawPile.length}</span>
          </div>
          <div className="sample-pile">
            <div className="discard-presentation">
              <div className="discard-stack" data-discard-target>
                {group.slice(-3).map((card, index) => (
                  <div
                    key={card.id}
                    data-discard-card={card.id}
                    style={{
                      transform: `translateX(${index * 7}px) rotate(${index * 3}deg)`,
                    }}
                  >
                    <PlayingCard card={card} />
                  </div>
                ))}
              </div>
              {animation?.outgoing.length ? (
                <div className="discard-underlay" aria-hidden="true">
                  {animation.previousGroup
                    .filter((card) => card.id !== animation.incoming?.card.id)
                    .slice(-1)
                    .map((card) => (
                      <PlayingCard card={card} key={card.id} />
                    ))}
                </div>
              ) : null}
            </div>
            <span>
              {choosing ? 'Previous discard' : 'Latest discard'} ·{' '}
              {group.length}
            </span>
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
                className={`hand-card ${selected.includes(card.id) ? 'selected-card' : ''} ${animation?.incoming?.card.id === card.id ? 'incoming-card-placeholder' : ''}`}
                data-hand-card={card.id}
                key={card.id}
                disabled={
                  !canSelect || (game.phase === 'penalty' && card.rank !== '7')
                }
                aria-label={`${cardLabel(card)}, ${cardValue(card, game.indicator.rank)} points, card ${index + 1}`}
                aria-pressed={selected.includes(card.id)}
                onClick={() => {
                  setSelectionError('')
                  setSelected((ids) =>
                    ids.includes(card.id)
                      ? ids.filter((id) => id !== card.id)
                      : [...ids, card.id],
                  )
                }}
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
        {visibleError && (
          <p role="alert" className="game-alert">
            {visibleError}
          </p>
        )}
        {yours && (
          <div className="turn-actions">
            {!choosing &&
              (game.phase === 'turn' || game.phase === 'penalty') && (
                <button
                  className="button button-primary"
                  data-plan-discard
                  disabled={!selectedCards.length}
                  onClick={discardSelected}
                >
                  {game.phase === 'penalty' || selectedCards[0]?.rank === '7'
                    ? 'Play selected 7s'
                    : matchesTop
                      ? 'Match & Drop'
                      : pickups.length
                        ? 'Choose draw source'
                        : 'Discard & draw automatically'}
                  {selectedCards.length ? ` (${selectedCards.length})` : ''}
                </button>
              )}
            {game.phase === 'turn' && !choosing && (
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
            {readyToDraw && (
              <button
                className="button button-primary"
                data-primary-draw
                onClick={() => chooseDraw('pile')}
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
            {choosing && (
              <button
                className="button button-secondary"
                onClick={() => {
                  setPending(null)
                  setSelectionError('')
                }}
              >
                Back to selection
              </button>
            )}
            {!!selectedCards.length && canSelect && (
              <button className="text-button" onClick={() => setSelected([])}>
                Clear selection
              </button>
            )}
          </div>
        )}
        {readyToDraw && (
          <div className="pickup-panel">
            <h3>Previous player’s eligible discard group</h3>
            {pickups.length ? (
              <>
                <p>
                  Choose one of these cards. Your selected discard and this
                  pickup will complete together.
                </p>
                <div className="pickup-cards">
                  {pickups.map((card) => (
                    <button
                      className="pickup-button"
                      data-pickup-card={card.id}
                      key={card.id}
                      aria-label={`Pick up ${cardLabel(card)}`}
                      onClick={() => chooseDraw('discard', card.id)}
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
      {animation && (
        <TurnAnimation motion={animation} onComplete={finishMotion} />
      )}
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
        <GameActivity events={gameEvents(game)} />
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
