import { MobileGameBar } from '../components/MobileGameBar'
import { OpponentSeat } from '../components/OpponentSeat'
import { useActiveSeat } from '../hooks/useActiveSeat'
import { TurnActions } from '../components/TurnActions'
import { TurnTimer } from '../components/TurnTimer'
import { latestActionHint, toggleHandCard } from '../lib/handSelection'
import { useAuth } from '../auth/AuthProvider'
import { PlayerHand } from '../components/PlayerHand'
import { gameEvents } from '../game/events'
import { GameActivity } from '../components/GameActivity'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayingCard } from '../components/PlayingCard'
import { RoundSummary } from '../components/RoundSummary'
import { cardLabel, handTotal } from '../game/deck'
import {
  canShow,
  inspectDiscard,
  isPlaying,
  latestGroup,
  pickupCards,
} from '../game/engine'
import type { Action, GameState } from '../game/engine'
import type { GameCard } from '../game/deck'
import {
  TurnAnimation,
  cardRect,
  handCardRect,
} from '../components/TurnAnimation'
import type { CardDeparture, TurnMotion } from '../components/TurnAnimation'
import type { useLocalGame } from '../hooks/useLocalGame'

export function GamePage({
  local,
}: {
  local: ReturnType<typeof useLocalGame>
}) {
  const auth = useAuth()
  const { game, now, error, canSave, send, start, reset } = local
  useActiveSeat(game?.current)
  const [count, setCount] = useState(4)
  const [selected, setSelected] = useState<string[]>([])
  const [motion, setMotion] = useState<
    (TurnMotion & { game: GameState; previousGroup: GameCard[] }) | null
  >(null)
  const [selectionError, setSelectionError] = useState('')
  const finishMotion = useCallback(() => setMotion(null), [])
  const animation = motion?.game === game ? motion : null
  const choosing = game?.phase === 'draw'
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
        run locally. Use a game room for live online play.
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
            Seven cards each. Keep your count low. Declare Least at five or
            less, and stay below 100 points.
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
              const from = handCardRect(elementFor('data-hand-card', card.id))
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
            cardRect(elementFor('data-pickup-card', action.cardId)) ??
            cardRect(
              document.querySelector('[data-discard-target] .playing-card'),
            ))
          : null
    const next = send(action)
    if (!next) return
    setSelected([])
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
      inspectDiscard(game, human.id, ids)
      executeMove({ type: 'discard', playerId: human.id, cardIds: ids })
    } catch (reason) {
      setSelectionError(
        reason instanceof Error ? reason.message : 'Check your selection.',
      )
    }
  }
  const chooseDraw = (source: 'pile' | 'discard', cardId?: string) => {
    if (!readyToDraw) return
    executeMove({ type: 'draw', playerId: human.id, source, cardId })
  }

  return (
    <section
      data-hand-count={human.hand.length}
      className={`game-page active-game ${human.hand.length > 14 ? 'expanded-hand' : ''} ${animation ? 'turn-in-motion' : ''} ${animation?.outgoing.length ? 'turn-discard-in-motion' : ''}`}
      aria-labelledby="game-title"
    >
      {header}
      <MobileGameBar
        round={game.round}
        activeName={current.name}
        seconds={playing && game.deadline !== null ? seconds : null}
        joker={game.indicator}
        penalty={game.phase === 'penalty' ? (game.sevens?.amount ?? 0) : 0}
        players={game.players}
      >
        <p>Local practice · cutoff 100</p>
        <button
          className="text-button"
          onClick={newGame}
          disabled={!!animation}
        >
          New game
        </button>
        <a className="text-link" href="#/">
          Back to the lounge
        </a>
        <a className="text-link" href="#/rules">
          How to Play →
        </a>
      </MobileGameBar>
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
            <OpponentSeat
              key={player.id}
              player={{ displayName: player.name, avatarUrl: null }}
              count={player.hand.length}
              score={player.score}
              active={game.current === index + 1 && playing}
              eliminated={player.eliminated}
              status={
                player.eliminated
                  ? `Out · ${player.eliminationReason}`
                  : 'Simulated opponent'
              }
              timer={
                game.current === index + 1 && playing ? (
                  <TurnTimer
                    seconds={game.deadline === null ? null : seconds}
                    name={player.name}
                  />
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
              <div
                className={`discard-stack ${game.phase === 'penalty' ? 'power-card-active' : ''}`}
                data-discard-target
              >
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
              {'Drop Pile'} · {group.length}
            </span>
          </div>
          <div className="sample-pile joker-indicator">
            <PlayingCard card={game.indicator} />
            <span>Round Joker · {game.indicator.rank}</span>
            <small>This rank is worth 0</small>
          </div>
        </div>
        <PlayerHand
          player={
            auth.user?.player ?? { displayName: human.name, avatarUrl: null }
          }
          total={handTotal(human.hand, game.indicator.rank)}
          score={human.score}
          active={playing && game.current === 0}
          timer={
            playing && game.current === 0 ? (
              <TurnTimer
                seconds={game.deadline === null ? null : seconds}
                name={human.name}
              />
            ) : null
          }
          empty={
            human.eliminated
              ? 'Your cards have been removed from play.'
              : 'An empty hand is worth zero.'
          }
        >
          {human.hand.map((card, index) => (
            <button
              className={`hand-card ${selected.includes(card.id) ? 'selected-card' : ''} ${animation?.incoming?.card.id === card.id ? 'incoming-card-placeholder' : ''}`}
              data-hand-card={card.id}
              key={card.id}
              disabled={
                !canSelect || (game.phase === 'penalty' && card.rank !== '7')
              }
              aria-label={`${cardLabel(card)}, card ${index + 1}`}
              aria-pressed={selected.includes(card.id)}
              onClick={() => {
                setSelectionError('')
                setSelected((ids) => toggleHandCard(human.hand, ids, card))
              }}
            >
              <PlayingCard card={card} />
            </button>
          ))}
        </PlayerHand>
      </div>
      <TurnActions
        phase={game.phase}
        yours={yours}
        activeName={current.name}
        moving={!!animation}
        hand={human.hand}
        selected={selectedCards}
        pickups={pickups}
        canDeclare={canShow(game, human.id)}
        penalty={game.sevens?.amount ?? 0}
        feedback={latestActionHint(gameEvents(game))}
        error={visibleError}
        onDrop={discardSelected}
        onDraw={() => chooseDraw('pile')}
        onPickup={(id) => chooseDraw('discard', id)}
        onDeclare={() => {
          setSelected([])
          send({ type: 'show', playerId: human.id })
        }}
        onPenalty={() => {
          setSelected([])
          send({ type: 'accept-penalty', playerId: human.id })
        }}
        onSelectAll={() =>
          setSelected(
            human.hand
              .filter((card) => card.rank === selectedCards[0]?.rank)
              .map((card) => card.id),
          )
        }
        onClear={() => setSelected([])}
      />
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
