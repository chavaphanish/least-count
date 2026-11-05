import { describe, expect, it } from 'vitest'
import { createCard } from './cards'
import type { Rank, Suit } from './cards'
import { assembleDeck, cardValue, handTotal } from './deck'
import type { GameCard } from './deck'
import {
  applyAction,
  canShow,
  createGame,
  inspectDiscard,
  latestGroup,
  pickupCards,
  TURN_MS,
} from './engine'
import type { Action, GameState } from './engine'
import { botView, chooseBotAction } from './bot'

let serial = 0
const card = (rank: Rank, suit: Suit = 'clubs'): GameCard => ({
  ...createCard(suit, rank),
  id: `test${serial++}`,
})
const joker = (): GameCard => ({
  id: `joker${serial++}`,
  rank: 'PJ',
  suit: 'joker',
})
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
function fixture(count = 3): GameState {
  const s = createGame(
    Array.from({ length: count }, (_, i) => `Player ${i}`),
    0,
    seeded(12),
  )
  s.current = 0
  s.starter = 0
  s.deadline = TURN_MS
  s.indicator = createCard('spades', '9')
  s.discards = [[card('4')]]
  s.drawPile = [
    card('8'),
    card('2'),
    card('3'),
    card('6'),
    card('10'),
    card('A'),
  ]
  s.eligible = []
  s.players.forEach((p) => {
    p.hand = [card('K'), card('5')]
    p.score = 0
  })
  return s
}
const act = (s: GameState, action: Action, now = 100) =>
  applyAction(s, action, now, seeded(3))
const discard = (s: GameState, ids: string[], now = 100) =>
  act(
    s,
    { type: 'discard', playerId: s.players[s.current].id, cardIds: ids },
    now,
  )

describe('game deck and values', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'prepares a complete deal for %i players with unique physical identities',
    (count) => {
      const s = createGame(
        Array.from({ length: count }, (_, i) => `P${i}`),
        10,
        seeded(count),
      )
      const all = [
        ...s.players.flatMap((p) => p.hand),
        ...s.drawPile,
        ...s.discards.flat(),
        s.indicator,
      ]
      expect(all).toHaveLength(count <= 4 ? 53 : 106)
      expect(new Set(all.map((c) => c.id)).size).toBe(all.length)
      expect(all.filter((c) => c.rank === 'PJ')).toHaveLength(
        count <= 4 ? 1 : 2,
      )
      expect(s.players.every((p) => p.hand.length === 7)).toBe(true)
      expect(s.indicator.rank).not.toBe('7')
      expect(s.indicator.rank).not.toBe('PJ')
      expect(s.eligible).toEqual([])
      expect(s.deadline).toBe(10 + TURN_MS)
    },
  )

  it('values jokers, selected ranks, aces, sevens, and faces without treating jokers as wild', () => {
    expect(cardValue(joker(), '9')).toBe(0)
    expect(cardValue(card('9', 'hearts'), '9')).toBe(0)
    expect(cardValue(card('A'), '9')).toBe(1)
    expect(cardValue(card('7'), '9')).toBe(7)
    expect(cardValue(card('7'), '7')).toBe(7)
    expect(handTotal([card('J'), card('Q'), card('K')], '9')).toBe(30)
  })

  it('does not start a penalty from an initial 7', () => {
    const s = Array.from({ length: 200 }, (_, seed) =>
      createGame(['A', 'B'], 0, seeded(seed)),
    ).find((game) => latestGroup(game)[0].rank === '7')!
    expect(s).toBeDefined()
    expect(s.sevens).toBeNull()
    expect(s.phase).toBe('turn')
  })

  it.each([1, 9, 2.5])('rejects unsupported player count %s', (count) => {
    expect(() => assembleDeck(count)).toThrow()
  })
})

describe('normal turns and pickup', () => {
  it('discards then draws exactly once, keeping the same deadline until completion', () => {
    const original = fixture()
    const before = structuredClone(original)
    const s = discard(original, [original.players[0].hand[0].id], 500)
    expect(original).toEqual(before)
    expect(s.phase).toBe('draw')
    expect(s.deadline).toBe(TURN_MS)
    expect(() => act(s, { type: 'show', playerId: 'p0' })).toThrow()
    const next = act(s, { type: 'draw', playerId: 'p0', source: 'pile' }, 1000)
    expect(next.players[0].hand).toHaveLength(2)
    expect(next.current).toBe(1)
    expect(next.deadline).toBe(1000 + TURN_MS)
    expect(() =>
      act(next, { type: 'draw', playerId: 'p0', source: 'pile' }),
    ).toThrow()
  })

  it('allows only the latest preceding group after consecutive Match and Drop actions', () => {
    let s = fixture()
    s.discards = [[card('5')]]
    s.players[0].hand = [card('5'), card('5'), card('K')]
    s.players[1].hand = [card('5'), card('Q')]
    const oldIds = s.players[0].hand.slice(0, 2).map((c) => c.id)
    const eligible = s.players[1].hand[0]
    s = discard(s, oldIds)
    expect(s.current).toBe(1)
    expect(s.players[0].hand).toHaveLength(1)
    expect(() =>
      act(s, { type: 'draw', playerId: 'p1', source: 'pile' }),
    ).toThrow()
    s = discard(s, [eligible.id])
    s = discard(s, [s.players[2].hand[0].id])
    expect(pickupCards(s)).toEqual([eligible])
    expect(() =>
      act(s, {
        type: 'draw',
        playerId: 'p2',
        source: 'discard',
        cardId: oldIds[0],
      }),
    ).toThrow()
    expect(() =>
      act(s, {
        type: 'draw',
        playerId: 'p2',
        source: 'discard',
        cardId: latestGroup(s)[0].id,
      }),
    ).toThrow()
    s = act(s, {
      type: 'draw',
      playerId: 'p2',
      source: 'discard',
      cardId: eligible.id,
    })
    expect(s.players[2].hand).toContainEqual(eligible)
    expect(s.discards.flat().filter((c) => c.id === eligible.id)).toHaveLength(
      0,
    )
  })

  it('blocks mixed ranks, duplicate selections, foreign ownership, wrong turns, and drawing before discarding', () => {
    const s = fixture()
    const before = structuredClone(s)
    const invalid: Action[] = [
      {
        type: 'discard',
        playerId: 'p0',
        cardIds: s.players[0].hand.map((c) => c.id),
      },
      {
        type: 'discard',
        playerId: 'p0',
        cardIds: [s.players[0].hand[0].id, s.players[0].hand[0].id],
      },
      { type: 'discard', playerId: 'p0', cardIds: [s.players[1].hand[0].id] },
      { type: 'discard', playerId: 'p1', cardIds: [s.players[1].hand[0].id] },
      { type: 'discard', playerId: 'p0', cardIds: [] },
      { type: 'draw', playerId: 'p0', source: 'pile' },
    ]
    for (const action of invalid) expect(() => act(s, action)).toThrow()
    expect(s).toEqual(before)
  })

  it('allows same-rank duplicates but rejects a printed joker grouped with a selected joker', () => {
    let s = fixture()
    s.players[0].hand = [card('Q'), card('Q')]
    s = discard(
      s,
      s.players[0].hand.map((c) => c.id),
    )
    expect(s.phase).toBe('draw')
    s = fixture()
    s.players[0].hand = [joker(), card('9')]
    expect(() =>
      discard(
        s,
        s.players[0].hand.map((c) => c.id),
      ),
    ).toThrow()
  })
})

describe('combined normal turns', () => {
  it('previews a valid selection without changing the hand, discard, or deadline', () => {
    const game = fixture()
    const before = structuredClone(game)
    const preview = inspectDiscard(game, 'p0', [game.players[0].hand[0].id])
    expect(preview.needsDraw).toBe(true)
    expect(preview.rank).toBe('K')
    expect(game).toEqual(before)
  })

  it('commits discard and closed draw with the same result as the existing turn rules', () => {
    const game = fixture()
    const before = structuredClone(game)
    const cardIds = [game.players[0].hand[0].id]
    const combined = act(game, {
      type: 'play-turn',
      playerId: 'p0',
      cardIds,
      source: 'pile',
    })
    const sequential = act(discard(game, cardIds), {
      type: 'draw',
      playerId: 'p0',
      source: 'pile',
    })
    expect(combined).toEqual(sequential)
    expect(combined.phase).toBe('turn')
    expect(combined.current).toBe(1)
    expect(game).toEqual(before)
  })

  it('can pick any one card in the preceding group while replacing its visible discard', () => {
    const game = fixture()
    const previous = [card('3', 'hearts'), card('3', 'diamonds')]
    game.discards = [previous]
    game.eligible = previous.map((c) => c.id)
    const outgoing = game.players[0].hand[0]
    const next = act(game, {
      type: 'play-turn',
      playerId: 'p0',
      cardIds: [outgoing.id],
      source: 'discard',
      cardId: previous[0].id,
    })
    expect(next.players[0].hand).toContainEqual(previous[0])
    expect(latestGroup(next)).toEqual([outgoing])
    expect(next.discards.flat()).not.toContainEqual(previous[0])
    expect(game.discards).toEqual([previous])
  })

  it('rejects an unavailable pickup atomically without leaving a partial discard', () => {
    const game = fixture()
    const outgoing = game.players[0].hand[0]
    const older = card('2')
    game.discards.unshift([older])
    game.eligible = latestGroup(game).map((c) => c.id)
    const before = structuredClone(game)
    for (const cardId of [older.id, outgoing.id, 'missing-card']) {
      expect(() =>
        act(game, {
          type: 'play-turn',
          playerId: 'p0',
          cardIds: [outgoing.id],
          source: 'discard',
          cardId,
        }),
      ).toThrow(/eligible group/)
      expect(game).toEqual(before)
    }
  })

  it('keeps Match and Drop draw-free and rejects attaching a pickup to it', () => {
    const game = fixture()
    game.players[0].hand = [card('4')]
    const ids = game.players[0].hand.map((c) => c.id)
    expect(inspectDiscard(game, 'p0', ids).needsDraw).toBe(false)
    expect(() =>
      act(game, {
        type: 'play-turn',
        playerId: 'p0',
        cardIds: ids,
        source: 'pile',
      }),
    ).toThrow(/without a replacement draw/)
    expect(game.players[0].hand).toHaveLength(1)
    expect(discard(game, ids).players[0].hand).toHaveLength(0)
  })

  it('activates a normal 7 only after the combined replacement draw', () => {
    const game = fixture()
    game.players[0].hand = [card('7'), card('K')]
    game.players[1].hand = [card('7')]
    const drawn = game.drawPile.at(-1)!
    const next = act(game, {
      type: 'play-turn',
      playerId: 'p0',
      cardIds: [game.players[0].hand[0].id],
      source: 'pile',
    })
    expect(next.players[0].hand).toContainEqual(drawn)
    expect(next.phase).toBe('penalty')
    expect(next.current).toBe(1)
    expect(next.sevens!.amount).toBe(2)
  })

  it('accepts a final choice before the deadline and eliminates instead if the choice is late', () => {
    const game = fixture()
    const action: Action = {
      type: 'play-turn',
      playerId: 'p0',
      cardIds: [game.players[0].hand[0].id],
      source: 'pile',
    }
    const early = act(game, action, TURN_MS - 1)
    expect(early.players[0].eliminated).toBe(false)
    expect(early.deadline).toBe(2 * TURN_MS - 1)
    const late = act(game, action, TURN_MS)
    expect(late.players[0].eliminationReason).toBe('timeout')
    expect(late.discards).toEqual(game.discards)
    expect(late.eligible).toEqual([])
  })

  it('settles exhaustion after the selected discard if the closed draw cannot finish', () => {
    const game = fixture()
    game.drawPile = []
    game.eligible = latestGroup(game).map((c) => c.id)
    const next = act(game, {
      type: 'play-turn',
      playerId: 'p0',
      cardIds: [game.players[0].hand[0].id],
      source: 'pile',
    })
    expect(next.result!.reason).toBe('exhaustion')
    expect(next.phase).toBe('round-over')
  })
})

describe('Show, scoring, and ordinary rounds', () => {
  it('scores a unique lowest Show and eliminates exactly at the cutoff', () => {
    const s = fixture()
    s.players[0].hand = [card('A'), card('2')]
    s.players[1].hand = [card('8')]
    s.players[1].score = 92
    s.players[2].hand = [card('K')]
    s.players[2].score = 89
    const next = act(s, { type: 'show', playerId: 'p0' })
    expect(next.result!.scores.map((p) => p.penalty)).toEqual([0, 8, 10])
    expect(next.players[1].eliminated).toBe(true)
    expect(next.players[2].score).toBe(99)
    expect(next.players[2].eliminated).toBe(false)
    const round = act(next, { type: 'next-round' }, 3000)
    expect(round.starter).toBe(2)
    expect(round.players[1].hand).toEqual([])
    expect(round.players[2].hand).toHaveLength(7)
    expect(round.round).toBe(2)
  })

  it.each([2, 4])(
    'awards 40 instead of caller total for a positive Show beaten or tied by %i',
    (opponentTotal) => {
      const s = fixture()
      s.players[0].hand = [card('4')]
      s.players[1].hand = [card(String(opponentTotal) as Rank)]
      s.players[2].hand = [card('K')]
      const next = act(s, { type: 'show', playerId: 'p0' })
      expect(next.result!.successful).toBe(false)
      expect(next.result!.scores.map((p) => p.penalty)).toEqual([40, 0, 10])
    },
  )

  it('awards zero to every tied lowest opponent on an unsuccessful Show', () => {
    const s = fixture()
    s.players[0].hand = [card('5')]
    s.players[1].hand = [card('2')]
    s.players[2].hand = [card('2')]
    expect(
      act(s, { type: 'show', playerId: 'p0' }).result!.scores.map(
        (p) => p.penalty,
      ),
    ).toEqual([40, 0, 0])
  })

  it('keeps two zero-point players at 99 and starts another ordinary round', () => {
    const s = fixture(2)
    s.players[0].hand = []
    s.players[1].hand = [joker(), card('9')]
    s.players.forEach((p) => {
      p.score = 99
    })
    expect(canShow(s, 'p0')).toBe(true)
    expect(() => discard(s, [])).toThrow(/must call Show/)
    const next = act(s, { type: 'show', playerId: 'p0' })
    expect(next.result!.winners).toEqual(['p0', 'p1'])
    expect(next.players.map((p) => p.score)).toEqual([99, 99])
    expect(next.phase).toBe('round-over')
    const round = act(next, { type: 'next-round' })
    expect(round.players.map((p) => p.score)).toEqual([99, 99])
    expect(round.phase).toBe('turn')
    expect(round.starter).toBe(1)
  })

  it('does not end a round when Match and Drop empties a hand', () => {
    let s = fixture()
    s.players[0].hand = [card('4')]
    s = discard(s, [s.players[0].hand[0].id])
    expect(s.phase).toBe('turn')
    expect(s.current).toBe(1)
    expect(s.result).toBeNull()
    expect(s.players[0].hand).toEqual([])
  })

  it('blocks Show above five and prevents further moves after settlement', () => {
    const s = fixture()
    expect(() => act(s, { type: 'show', playerId: 'p0' })).toThrow()
    s.players[0].hand = [card('A')]
    const next = act(s, { type: 'show', playerId: 'p0' })
    expect(() => discard(next, [s.players[0].hand[0].id])).toThrow()
  })

  it('changes from two decks to one between rounds after elimination, not mid-round', () => {
    const s = fixture(5)
    s.players[0].hand = [card('A')]
    s.players[4].score = 99
    const next = act(s, { type: 'show', playerId: 'p0' })
    const round = act(next, { type: 'next-round' })
    const all = [
      ...round.players.flatMap((p) => p.hand),
      ...round.drawPile,
      ...round.discards.flat(),
      round.indicator,
    ]
    expect(all).toHaveLength(53)
  })
})

describe('7 sequences and timeout', () => {
  it.each([2, 4, 8])(
    'requires every active player in a %i-player full cycle and returns to the initiator',
    (count) => {
      let s = fixture(count)
      s.discards = [[card('7')]]
      s.players.forEach((p) => {
        p.hand = [card('7')]
      })
      for (let index = 0; index < count; index++) {
        expect(s.current).toBe(index)
        s = discard(s, [s.players[index].hand[0].id])
        if (index < count - 1) expect(s.sevens!.amount).toBe((index + 1) * 2)
      }
      expect(s.sevens).toBeNull()
      expect(s.current).toBe(0)
      expect(s.phase).toBe('turn')
      expect(canShow(s, 'p0')).toBe(true)
    },
  )

  it('requires the initiating normal draw, adds two per action, and cancels a full cycle', () => {
    let s = fixture()
    s.players.forEach((p) => {
      p.hand = [card('7'), card('7'), card('K')]
    })
    s = discard(
      s,
      s.players[0].hand.slice(0, 2).map((c) => c.id),
    )
    expect(s.phase).toBe('draw')
    expect(s.sevens).toBeNull()
    s = act(s, { type: 'draw', playerId: 'p0', source: 'pile' })
    expect(s.sevens!.amount).toBe(2)
    expect(s.phase).toBe('penalty')
    expect(() => act(s, { type: 'show', playerId: 'p1' })).toThrow()
    expect(() => discard(s, [s.players[1].hand[2].id])).toThrow()
    s = discard(
      s,
      s.players[1].hand.slice(0, 2).map((c) => c.id),
    )
    expect(s.sevens!.amount).toBe(4)
    s = discard(s, [s.players[2].hand[0].id])
    expect(s.sevens).toBeNull()
    expect(s.current).toBe(0)
    expect(s.phase).toBe('turn')
  })

  it('starts a 7 penalty without a normal draw when the top rank also matches 7', () => {
    let s = fixture()
    s.discards = [[card('7')]]
    s.players[0].hand = [card('7'), card('Q')]
    s.players[1].hand = [card('7')]
    s = discard(s, [s.players[0].hand[0].id])
    expect(s.phase).toBe('penalty')
    expect(s.players[0].hand).toHaveLength(1)
    expect(s.sevens!.amount).toBe(2)
  })

  it('automatically draws for a player with no 7, skips their normal turn, and clears pickup', () => {
    let s = fixture()
    s.discards = [[card('7')]]
    s.players[0].hand = [card('7')]
    s.players[1].hand = [joker(), card('9')]
    s = discard(s, [s.players[0].hand[0].id])
    expect(s.current).toBe(2)
    expect(s.players[1].hand).toHaveLength(4)
    expect(s.eligible).toEqual([])
    s = discard(s, [s.players[2].hand[0].id])
    expect(pickupCards(s)).toEqual([])
    expect(() =>
      act(s, {
        type: 'draw',
        playerId: 'p2',
        source: 'discard',
        cardId: s.discards[1][0].id,
      }),
    ).toThrow()
  })

  it('lets a player holding 7 accept the accumulated penalty instead', () => {
    let s = fixture()
    s.discards = [[card('7')]]
    s.players[0].hand = [card('7')]
    s.players[1].hand = [card('7')]
    s = discard(s, [s.players[0].hand[0].id])
    s = act(s, { type: 'accept-penalty', playerId: 'p1' })
    expect(s.players[1].hand).toHaveLength(3)
    expect(s.current).toBe(2)
    expect(s.sevens).toBeNull()
  })

  it('eliminates on the exact deadline, including a late action, without resetting scores', () => {
    const s = fixture()
    s.eligible = latestGroup(s).map((c) => c.id)
    s.players[0].score = 12
    expect(() => act(s, { type: 'timeout' }, TURN_MS - 1)).toThrow()
    const next = discard(s, [s.players[0].hand[0].id], TURN_MS)
    expect(next.players[0].eliminated).toBe(true)
    expect(next.players[0].hand).toEqual([])
    expect(next.players[0].score).toBe(12)
    expect(next.eligible).toEqual([])
    expect(next.current).toBe(1)
    expect(next.phase).toBe('turn')
  })

  it('cancels a 7 sequence on timeout and gives the next player a normal turn', () => {
    let s = fixture()
    s.discards = [[card('7')]]
    s.players[0].hand = [card('7')]
    s.players[1].hand = [card('7')]
    s = discard(s, [s.players[0].hand[0].id])
    s = act(s, { type: 'timeout' }, s.deadline!)
    expect(s.players[1].eliminationReason).toBe('timeout')
    expect(s.current).toBe(2)
    expect(s.sevens).toBeNull()
    expect(s.phase).toBe('turn')
    expect(s.eligible).toEqual([])
  })

  it('ends the match when a timeout leaves just one active player', () => {
    const s = act(fixture(2), { type: 'timeout' }, TURN_MS)
    expect(s.phase).toBe('game-over')
    expect(s.result!.winners).toEqual(['p1'])
    expect(s.deadline).toBeNull()
    expect(() => act(s, { type: 'next-round' })).toThrow()
  })
})

describe('draw-pile recycling and exhaustion', () => {
  it('recycles older discards while protecting the preceding pickup group and current discard', () => {
    let s = fixture()
    const older = [card('A'), card('2')]
    const pickup = [card('3'), card('3')]
    s.discards = [older, pickup]
    s.eligible = pickup.map((c) => c.id)
    s.drawPile = []
    const own = s.players[0].hand[0]
    s = discard(s, [own.id])
    s = act(s, { type: 'draw', playerId: 'p0', source: 'pile' })
    expect(s.drawPile).toHaveLength(1)
    expect(
      s.players[0].hand.some((c) => older.some((o) => o.id === c.id)),
    ).toBe(true)
    expect(s.discards.flat()).toEqual([...pickup, own])
  })

  it('settles by minimum hand totals if a normal replacement cannot be drawn', () => {
    let s = fixture()
    s.players[0].hand = [card('K'), card('A')]
    s.drawPile = []
    s.eligible = latestGroup(s).map((c) => c.id)
    s = discard(s, [s.players[0].hand[0].id])
    s = act(s, { type: 'draw', playerId: 'p0', source: 'pile' })
    expect(s.phase).toBe('round-over')
    expect(s.result!.reason).toBe('exhaustion')
    expect(s.result!.scores[0].penalty).toBe(0)
  })

  it('draws available penalty cards before settling an unfulfillable penalty', () => {
    let s = fixture()
    s.discards = [[card('7')]]
    s.eligible = latestGroup(s).map((c) => c.id)
    s.players[0].hand = [card('K'), card('7')]
    s.phase = 'penalty'
    s.sevens = { initiator: 2, participants: [2, 1], amount: 4 }
    s.drawPile = [card('2')]
    s = act(s, { type: 'accept-penalty', playerId: 'p0' })
    expect(s.result!.reason).toBe('exhaustion')
    expect(s.result!.scores.find((p) => p.id === 'p0')!.total).toBe(19)
    expect(s.players[0].hand).toHaveLength(3)
  })
})

describe('simulated opponents and whole matches', () => {
  it('exposes only own cards and public information to the strategy', () => {
    const view = botView(fixture())
    expect(Object.keys(view).sort()).toEqual([
      'hand',
      'phase',
      'pickup',
      'playerId',
      'selectedRank',
      'topRank',
    ])
    expect('players' in view).toBe(false)
    expect('drawPile' in view).toBe(false)
  })

  it.each([2, 4, 8])(
    'completes seeded %i-player matches without illegal bot actions or duplicated cards',
    (count) => {
      for (const seed of [15, 42, 87]) {
        const random = seeded(seed)
        let s = createGame(
          Array.from({ length: count }, (_, i) => `P${i}`),
          0,
          random,
        )
        let step = 0
        while (s.phase !== 'game-over' && step < 5000) {
          const action =
            s.phase === 'round-over'
              ? { type: 'next-round' as const }
              : chooseBotAction(botView(s))
          s = applyAction(s, action, ++step * 100, random)
          const cards = [
            ...s.players.flatMap((p) => p.hand),
            ...s.drawPile,
            ...s.discards.flat(),
            s.indicator,
          ]
          expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
          expect(s.players.every((p) => p.score >= 0)).toBe(true)
          if (['turn', 'draw', 'penalty'].includes(s.phase)) {
            expect(cards).toHaveLength(
              s.players.filter((p) => !p.eliminated).length <= 4 ? 53 : 106,
            )
          }
        }
        expect(s.phase).toBe('game-over')
        expect(s.players.filter((p) => !p.eliminated)).toHaveLength(1)
      }
    },
  )
})
