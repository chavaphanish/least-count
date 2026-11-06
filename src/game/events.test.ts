import { describe, expect, it } from 'vitest'
import { createCard } from './cards'
import type { Rank } from './cards'
import {
  applyAction,
  createGame,
  inspectDiscard,
  resolveForcedDraw,
} from './engine'
import type { GameState } from './engine'
import {
  formatCardGroup,
  formatCardName,
  formatGameEvent,
  HISTORY_LIMIT,
  gameEvents,
} from './events'
let serial = 0
const card = (rank: Rank) => ({
  ...createCard('hearts', rank),
  id: `public-${serial++}`,
})
function fixture(timedGame = true) {
  const s = createGame(['Alex', 'Ben', 'Chris'], 0, () => 0.6, {
    timedGame,
    eliminationThreshold: 100,
  })
  s.phase = 'turn'
  s.sevens = null
  s.current = 0
  s.starter = 0
  s.deadline = timedGame ? 60_000 : null
  s.events = []
  s.eventSequence = 0
  s.log = []
  s.discards = [[card('3')]]
  s.eligible = []
  s.indicator = createCard('spades', '9')
  s.players.forEach((p) => {
    p.hand = [card('K'), card('7')]
  })
  s.drawPile = [card('A'), card('2'), card('5'), card('6'), card('8')]
  return s
}
const discard = (s: GameState, ids = [s.players[s.current].hand[0].id]) =>
  applyAction(
    s,
    { type: 'discard', playerId: s.players[s.current].id, cardIds: ids },
    100,
  )
describe('automatic transitions and public event history', () => {
  it.each([true, false])(
    'ends initiating and responding 7 actions without drawing (timed=%s)',
    (timed) => {
      let s = fixture(timed)
      const pile = [...s.drawPile]
      for (let i = 0; i < 3; i++) {
        const seven = s.players[i].hand.find((c) => c.rank === '7')!
        expect(inspectDiscard(s, `p${i}`, [seven.id])).toMatchObject({
          outcome: 'seven',
          needsDraw: false,
          needsChoice: false,
        })
        s = discard(s, [seven.id])
        expect(s.drawPile).toEqual(pile)
        expect(s.players[i].hand).toHaveLength(1)
        expect(s.deadline).toBe(timed ? 60_100 : null)
      }
      expect(s.current).toBe(0)
      expect(s.phase).toBe('turn')
      expect(s.sevens).toBeNull()
      expect(s.events!.at(-1)?.type).toBe('POWER_SEVEN_CYCLE_COMPLETED')
      expect(s.events!.filter((e) => e.type === 'TURN_COMPLETED')).toHaveLength(
        0,
      )
    },
  )
  it('draws exactly once atomically and never puts the hidden replacement in events', () => {
    const s = fixture()
    const hidden = s.drawPile.at(-1)!
    const next = discard(s)
    expect(s.players[0].hand).toHaveLength(2)
    expect(next.players[0].hand).toContainEqual(hidden)
    expect(next.drawPile.length).toBe(s.drawPile.length - 1)
    expect(next.current).toBe(1)
    expect(next.events).toHaveLength(1)
    expect(next.events![0]).toMatchObject({
      type: 'TURN_COMPLETED',
      draw: 'automatic',
      player: { id: 'p0' },
    })
    expect(JSON.stringify(next.events)).not.toContain(hidden.id)
    for (const opponent of s.players.slice(1))
      for (const c of opponent.hand)
        expect(JSON.stringify(next.events)).not.toContain(c.id)
    expect(formatGameEvent(next.events![0])).toContain(
      'automatically drew a card',
    )
    expect(() =>
      applyAction(next, { type: 'draw', playerId: 'p0', source: 'pile' }, 101),
    ).toThrow()
  })
  it('retains manual choice and summarizes a completed public pickup in one event', () => {
    const s = fixture()
    s.eligible = s.discards[0].map((c) => c.id)
    const pickup = s.discards[0][0]
    expect(inspectDiscard(s, 'p0', [s.players[0].hand[0].id]).needsChoice).toBe(
      true,
    )
    const waiting = discard(s)
    expect(waiting.deadline).toBe(60_000)
    expect(waiting.events).toEqual([])
    const done = applyAction(
      waiting,
      { type: 'draw', playerId: 'p0', source: 'discard', cardId: pickup.id },
      200,
    )
    expect(done.events).toHaveLength(1)
    expect(done.events![0]).toMatchObject({
      type: 'TURN_COMPLETED',
      draw: 'pickup',
      pickup,
    })
    expect(formatGameEvent(done.events![0])).toContain(
      'picked up the 3 of Hearts',
    )
  })
  it('rejects a combined seven draw and leaves input state/history untouched', () => {
    const s = fixture()
    const before = structuredClone(s)
    expect(() =>
      applyAction(
        s,
        {
          type: 'play-turn',
          playerId: 'p0',
          cardIds: [s.players[0].hand[1].id],
          source: 'pile',
        },
        100,
      ),
    ).toThrow(/no replacement/)
    expect(s).toEqual(before)
  })
  it('allows a combined automatic command from older clients without a second draw', () => {
    const s = fixture()
    const done = applyAction(
      s,
      {
        type: 'play-turn',
        playerId: 'p0',
        cardIds: [s.players[0].hand[0].id],
        source: 'pile',
      },
      100,
    )
    expect(done.drawPile).toHaveLength(s.drawPile.length - 1)
    expect(done.events).toHaveLength(1)
  })
  it('replenishes before automatic drawing and settles exhaustion without getting stuck', () => {
    const s = fixture()
    s.drawPile = []
    const recycled = discard(s)
    expect(recycled.current).toBe(1)
    expect(recycled.events!.some((e) => e.type === 'PILE_RECYCLED')).toBe(true)
    s.discards = []
    const exhausted = discard(s)
    expect(exhausted.phase).toBe('round-over')
    expect(
      exhausted.events!.some(
        (e) => e.type === 'ROUND_COMPLETED' && e.reason === 'exhaustion',
      ),
    ).toBe(true)
  })
  it('preserves Match and Drop and generates no hidden draw or seven event', () => {
    const s = fixture()
    s.discards = [[card('K')]]
    const done = discard(s)
    expect(done.drawPile).toEqual(s.drawPile)
    expect(done.events).toHaveLength(1)
    expect(done.events![0]).toMatchObject({
      type: 'TURN_COMPLETED',
      draw: 'none',
    })
  })
  it('orders unique events through Show, scoring, elimination, and the next round', () => {
    const s = fixture()
    s.players[0].hand = [card('A')]
    s.players[1].score = 99
    const done = applyAction(s, { type: 'show', playerId: 'p0' }, 100)
    expect(done.events!.map((e) => e.type)).toEqual([
      'SHOW_DECLARED',
      'SHOW_RESOLVED',
      'ROUND_COMPLETED',
      'PLAYER_ELIMINATED',
    ])
    const next = applyAction(done, { type: 'next-round' }, 200, () => 0.6)
    expect(next.events!.at(-1)).toMatchObject({
      type: 'ROUND_STARTED',
      roundNumber: 2,
      timestamp: 200,
    })
    expect(new Set(next.events!.map((e) => e.id)).size).toBe(
      next.events!.length,
    )
    expect(next.events!.map((e) => e.sequenceNumber)).toEqual(
      next.events!.map((_, i) => i + 1),
    )
  })
  it('normalizes old forced-draw saves exactly once and keeps manual-choice saves pending', () => {
    const s = fixture()
    s.phase = 'draw'
    s.discardedRank = 'K'
    const done = resolveForcedDraw(s, 100)
    expect(done.current).toBe(1)
    expect(resolveForcedDraw(done, 200)).toBe(done)
    s.eligible = s.discards[0].map((c) => c.id)
    expect(resolveForcedDraw(s, 100)).toBe(s)
    s.discardedRank = '7'
    s.discards = [[card('7')]]
    const seven = resolveForcedDraw(s, 100)
    expect(seven.drawPile).toEqual(s.drawPile)
    expect(seven.phase).toBe('penalty')
  })
  it('bounds retained history without reusing event sequence numbers', () => {
    const s = fixture()
    const event = {
      type: 'PILE_RECYCLED' as const,
      roundNumber: 1,
      timestamp: 0,
    }
    s.events = Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
      ...event,
      id: `event-${i + 1}`,
      sequenceNumber: i + 1,
    }))
    s.eventSequence = HISTORY_LIMIT
    const done = discard(s)
    expect(done.events).toHaveLength(HISTORY_LIMIT)
    expect(done.events!.at(-1)?.sequenceNumber).toBe(HISTORY_LIMIT + 1)
    expect(done.events![0].sequenceNumber).toBe(2)
  })
})
describe('public card descriptions', () => {
  it('formats face cards, numeric cards, suits, and matching groups', () => {
    expect(formatCardName(card('Q'))).toBe('Queen of Hearts')
    expect(formatCardGroup([card('K'), card('K')])).toBe('two Kings')
    expect(formatCardGroup([card('5'), card('5'), card('5')])).toBe('three 5s')
    const joker = { id: 'pj', rank: 'PJ' as const, suit: 'joker' as const }
    expect(formatCardName(joker)).toBe('Printed Joker')
    expect(formatCardGroup([joker, { ...joker, id: 'pj2' }])).toBe(
      'two Printed Jokers',
    )
  })
})

it('preserves old public text history and continues its sequence after upgrade', () => {
  const s = fixture()
  delete s.events
  delete s.eventSequence
  s.log = ['Alex discarded a King.']
  expect(gameEvents(s)[0]).toMatchObject({
    type: 'LEGACY_ACTIVITY',
    roundNumber: 0,
    sequenceNumber: 1,
  })
  const done = discard(s)
  expect(done.events![0]).toMatchObject({
    type: 'LEGACY_ACTIVITY',
    message: s.log[0],
  })
  expect(done.events![1].sequenceNumber).toBe(2)
})

it('uses Round Joker in current and historical public round announcements', () => {
  const s = createGame(['Alex', 'Ben'], 0, () => 0.6)
  const opening = gameEvents(s).find(event => event.type === 'ROUND_STARTED')!
  expect(formatGameEvent(opening)).toContain('Round Joker rank')
  const legacy = { ...opening, type: 'LEGACY_ACTIVITY' as const, message: 'Round 1: selected joker rank 9. Selected Joker stays all round.' }
  expect(formatGameEvent(legacy)).toBe('Round 1: Round Joker rank 9. Round Joker stays all round.')
  expect(legacy.message).toContain('selected joker')
})

it('normalizes old public activity without rewriting stored events', () => {
  const s = fixture()
  s.events = undefined
  s.log = ['Alex discarded a Queen. Ben called Show. Selected Joker rank 9.']
  const event = gameEvents(s)[0]
  expect(formatGameEvent(event)).toBe('Alex dropped a Queen. Ben declared Least. Round Joker rank 9.')
  expect(s.log[0]).toContain('discarded')
})
