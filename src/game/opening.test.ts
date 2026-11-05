import { describe, expect, it } from 'vitest'
import { createCard } from './cards'
import {
  applyAction,
  canShow,
  createGame,
  inspectDiscard,
  latestGroup,
  TURN_MS,
} from './engine'
import type { GameState } from './engine'
import { cardValue, handTotal } from './deck'
import { isSavedGame } from '../lib/session'
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
export function openingFixture(
  seven = false,
  hasSeven = true,
  timedGame = true,
  count = 3,
): GameState {
  for (let seed = 1; seed < 3000; seed++) {
    const s = createGame(
      Array.from({ length: count }, (_, i) => `Player ${i}`),
      100,
      seeded(seed),
      { timedGame, eliminationThreshold: 100 },
    )
    const card = latestGroup(s)[0]
    if ((card.rank === '7') !== seven) continue
    if (s.players[s.starter].hand.some((c) => c.rank === '7') !== hasSeven)
      continue
    if (seven && hasSeven && s.phase !== 'penalty') continue
    return s
  }
  throw new Error('No matching seeded opening')
}
function allCards(s: GameState) {
  return [
    ...s.players.flatMap((p) => p.hand),
    ...s.drawPile,
    ...s.discards.flat(),
    s.indicator,
  ]
}
function choose(s: GameState, source: 'pile' | 'discard', now = 200) {
  return applyAction(
    s,
    {
      type: 'opening-draw',
      playerId: s.players[s.current].id,
      source,
      cardId: source === 'discard' ? latestGroup(s)[0]?.id : undefined,
    },
    now,
    () => 0.6,
  )
}
describe('draw-first round opening', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'deals seven each and exposes a single legal opening choice (%i players)',
    (count) => {
      const s = openingFixture(false, true, true, count)
      expect(s.phase).toBe('opening-draw')
      expect(s.players.every((p) => p.hand.length === 7)).toBe(true)
      expect(s.eligible).toEqual([latestGroup(s)[0].id])
      const all = allCards(s)
      expect(all).toHaveLength(count <= 4 ? 53 : 106)
      expect(new Set(all.map((c) => c.id)).size).toBe(all.length)
      expect(s.events![0]).toMatchObject({
        type: 'ROUND_STARTED',
        openingCard: latestGroup(s)[0],
      })
    },
  )
  it.each(['pile', 'discard'] as const)(
    'acquires exactly one physical card from %s, then discards without replacement',
    (source) => {
      const s = openingFixture()
      const owner = s.current
      const opener = latestGroup(s)[0]
      const selected = source === 'discard' ? opener : s.drawPile.at(-1)!
      const before = allCards(s)
        .map((c) => c.id)
        .sort()
      const drawn = choose(s, source)
      expect(drawn.phase).toBe('opening-discard')
      expect(drawn.current).toBe(owner)
      expect(drawn.players[owner].hand).toHaveLength(8)
      expect(drawn.players[owner].hand).toContainEqual(selected)
      expect(drawn.discards.flat().some((c) => c.id === opener.id)).toBe(
        source === 'pile',
      )
      expect(drawn.drawPile.length).toBe(
        s.drawPile.length - (source === 'pile' ? 1 : 0),
      )
      expect(drawn.deadline).toBe(s.deadline)
      expect(isSavedGame(drawn)).toBe(true)
      const discard = drawn.players[owner].hand.find((c) => c.rank !== '7')!
      expect(
        inspectDiscard(drawn, drawn.players[owner].id, [discard.id]).outcome,
      ).toBe('opening')
      const done = applyAction(
        drawn,
        {
          type: 'discard',
          playerId: drawn.players[owner].id,
          cardIds: [discard.id],
        },
        300,
      )
      expect(done.players[owner].hand).toHaveLength(7)
      expect(done.drawPile).toEqual(drawn.drawPile)
      expect(done.current).not.toBe(owner)
      expect(done.phase).toBe('turn')
      expect(done.deadline).toBe(300 + TURN_MS)
      expect(
        allCards(done)
          .map((c) => c.id)
          .sort(),
      ).toEqual(before)
      expect(done.events!.at(-1)).toMatchObject({
        type: 'TURN_COMPLETED',
        opening: true,
        draw: 'none',
      })
      const acquisition = drawn.events!.at(-1)!
      expect(acquisition).toMatchObject({
        type: 'OPENING_CARD_SELECTED',
        source,
      })
      if (source === 'pile') {
        expect('card' in acquisition).toBe(false)
        expect(JSON.stringify(acquisition)).not.toContain(selected.id)
      } else expect(acquisition).toMatchObject({ card: opener })
    },
  )
  it('rejects discard before choice, second acquisitions, replacement draws, and wrong actors atomically', () => {
    const s = openingFixture()
    const player = s.players[s.current]
    expect(() =>
      applyAction(
        s,
        { type: 'discard', playerId: player.id, cardIds: [player.hand[0].id] },
        200,
      ),
    ).toThrow()
    expect(() =>
      applyAction(
        s,
        { type: 'draw', playerId: player.id, source: 'pile' },
        200,
      ),
    ).toThrow()
    expect(() =>
      applyAction(
        s,
        {
          type: 'opening-draw',
          playerId: s.players[(s.current + 1) % s.players.length].id,
          source: 'pile',
        },
        200,
      ),
    ).toThrow(/Wait/)
    const drawn = choose(s, 'discard')
    const before = structuredClone(drawn)
    expect(() => choose(drawn, 'pile')).toThrow(/not available/)
    expect(() =>
      applyAction(
        drawn,
        { type: 'draw', playerId: player.id, source: 'pile' },
        250,
      ),
    ).toThrow()
    expect(() =>
      applyAction(
        drawn,
        {
          type: 'play-turn',
          playerId: player.id,
          cardIds: [player.hand[0].id],
          source: 'pile',
        },
        250,
      ),
    ).toThrow()
    expect(drawn).toEqual(before)
  })
  it('allows matching groups and 7s after acquisition, with no second replacement', () => {
    for (const rank of ['7', 'K'] as const) {
      const drawn = choose(openingFixture(), 'pile')
      const owner = drawn.current
      if (rank === 'K')
        drawn.players[owner].hand = [
          { ...createCard('clubs', 'K'), id: 'k1' },
          { ...createCard('hearts', 'K'), id: 'k2' },
        ]
      const ids = drawn.players[owner].hand
        .filter((c) => c.rank === rank)
        .map((c) => c.id)
      const done = applyAction(
        drawn,
        { type: 'discard', playerId: drawn.players[owner].id, cardIds: ids },
        300,
      )
      expect(done.players[owner].hand).toHaveLength(
        drawn.players[owner].hand.length - ids.length,
      )
      if (rank === '7')
        expect(
          done.events!.some(
            (e) =>
              e.type === 'POWER_SEVEN_PLAYED' &&
              e.player.id === drawn.players[owner].id &&
              e.penalty === 2,
          ),
        ).toBe(true)
      else expect(done.drawPile).toEqual(drawn.drawPile)
    }
  })
  it('allows Show with an original seven-card low hand but never after acquisition', () => {
    const s = openingFixture()
    const owner = s.current
    const pool = [...s.players.flatMap((p) => p.hand), ...s.drawPile].sort(
      (a, b) => cardValue(a, s.indicator.rank) - cardValue(b, s.indicator.rank),
    )
    s.players[owner].hand = pool.splice(0, 7)
    for (const p of s.players)
      if (p !== s.players[owner]) p.hand = pool.splice(0, 7)
    s.drawPile = pool
    expect(s.players[owner].hand).toHaveLength(7)
    expect(
      handTotal(s.players[owner].hand, s.indicator.rank),
    ).toBeLessThanOrEqual(5)
    expect(canShow(s, s.players[owner].id)).toBe(true)
    expect(
      applyAction(s, { type: 'show', playerId: s.players[owner].id }, 200)
        .result!.reason,
    ).toBe('show')
    const drawn = choose(s, 'pile')
    expect(canShow(drawn, s.players[owner].id)).toBe(false)
    expect(() =>
      applyAction(drawn, { type: 'show', playerId: s.players[owner].id }, 250),
    ).toThrow()
  })
  it.each([true, false])(
    'retains the opening deadline across choice/refresh (timed=%s)',
    (timed) => {
      const s = openingFixture(false, true, timed)
      const drawn = choose(s, 'discard')
      expect(drawn.deadline).toBe(timed ? 60100 : null)
      expect(isSavedGame(drawn)).toBe(true)
      expect(isSavedGame(JSON.parse(JSON.stringify(drawn)))).toBe(true)
      if (timed) {
        for (const state of [s, drawn]) {
          const done = applyAction(state, { type: 'timeout' }, 60100)
          expect(done.players[s.current].eliminationReason).toBe('timeout')
          expect(isSavedGame(done)).toBe(true)
        }
      }
    },
  )
})
describe('opening 7 penalty', () => {
  it.each([true, false])(
    'activates before normal play and excludes pickup, Show, and non-7 discards (timed=%s)',
    (timed) => {
      const s = openingFixture(true, true, timed)
      const p = s.players[s.current]
      expect(s.phase).toBe('penalty')
      expect(s.sevens).toMatchObject({
        amount: 2,
        participants: [],
        initiator: s.starter,
        opening: true,
      })
      expect(isSavedGame(s)).toBe(true)
      expect(canShow(s, p.id)).toBe(false)
      expect(() => choose(s, 'discard')).toThrow()
      expect(() =>
        applyAction(s, { type: 'show', playerId: p.id }, 200),
      ).toThrow()
      const other = p.hand.find((c) => c.rank !== '7')!
      expect(() =>
        applyAction(
          s,
          { type: 'discard', playerId: p.id, cardIds: [other.id] },
          200,
        ),
      ).toThrow()
      const accepted = applyAction(
        s,
        { type: 'accept-penalty', playerId: p.id },
        200,
      )
      expect(accepted.players[s.current].hand).toHaveLength(9)
      expect(accepted.sevens).toBeNull()
      expect(accepted.phase).toBe('turn')
      expect(accepted.current).not.toBe(s.current)
    },
  )
  it('automatically draws exactly two and skips an opener with no 7', () => {
    const s = openingFixture(true, false)
    expect(s.players[s.starter].hand).toHaveLength(9)
    expect(s.current).toBe((s.starter + 1) % s.players.length)
    expect(s.phase).toBe('turn')
    expect(s.events!.map((e) => e.type)).toEqual([
      'ROUND_STARTED',
      'OPENING_SEVEN_ACTIVATED',
      'POWER_SEVEN_PENALTY_DRAWN',
    ])
    const e = s.events!.at(-1)!
    expect(e).toMatchObject({ count: 2 })
    expect('cards' in e).toBe(false)
    expect(new Set(allCards(s).map((c) => c.id)).size).toBe(53)
  })
  it('a response starts at four penalty cards, counting the responder exactly once', () => {
    const s = openingFixture(true)
    const owner = s.current
    const sevens = s.players[owner].hand.filter((c) => c.rank === '7')
    const done = applyAction(
      s,
      {
        type: 'discard',
        playerId: s.players[owner].id,
        cardIds: sevens.map((c) => c.id),
      },
      200,
    )
    expect(done.players[owner].hand).toHaveLength(7 - sevens.length)
    expect(
      done.events!.some(
        (e) => e.type === 'POWER_SEVEN_PLAYED' && e.penalty === 4,
      ),
    ).toBe(true)
    if (done.sevens) expect(done.sevens.participants).toEqual([owner])
  })
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'tracks only player responses and restores the initiator after a full cycle (%i seats)',
    (count) => {
      // State-machine coverage. With physical decks an opening full cycle is unreachable at 4/8 seats.
      let s = openingFixture(true, true, true, count)
      const first = s.current
      s.players.forEach((p, i) => {
        p.hand = [{ ...createCard('clubs', '7'), id: `response-${i}` }]
      })
      for (let step = 0; step < count; step++) {
        const index = s.current
        s = applyAction(
          s,
          {
            type: 'discard',
            playerId: s.players[index].id,
            cardIds: [s.players[index].hand[0].id],
          },
          200 + step,
        )
        if (step < count - 1) {
          expect(s.sevens!.participants).toHaveLength(step + 1)
          expect(s.sevens!.amount).toBe(2 + (step + 1) * 2)
        }
      }
      expect(s.sevens).toBeNull()
      expect(s.phase).toBe('turn')
      expect(s.current).toBe(first)
      expect(s.events!.at(-1)).toMatchObject({
        type: 'POWER_SEVEN_CYCLE_COMPLETED',
        opening: true,
      })
    },
  )
  it.each([4, 8])(
    'preserves the physical 7 supply with an opening 7 (%i seats)',
    (count) => {
      const s = openingFixture(true, true, true, count)
      const remaining = allCards(s).filter(
        (c) => c.rank === '7' && c.id !== latestGroup(s)[0].id,
      )
      expect(remaining).toHaveLength(count - 1)
    },
  )
})

it.each(['printed', 'selected'])(
  'allows the public %s Joker opening to be picked up',
  (kind) => {
    let s: GameState | undefined
    for (let seed = 0; seed < 3000; seed++) {
      const candidate = createGame(['Alex', 'Ben'], 100, seeded(seed))
      const opening = latestGroup(candidate)[0]
      if (
        kind === 'printed'
          ? opening.rank === 'PJ'
          : opening.rank === candidate.indicator.rank
      ) {
        s = candidate
        break
      }
    }
    expect(s).toBeDefined()
    const card = latestGroup(s!)[0]
    const done = choose(s!, 'discard')
    expect(done.players[s!.current].hand).toContainEqual(card)
    expect(done.phase).toBe('opening-discard')
    expect(new Set(allCards(done).map((c) => c.id)).size).toBe(53)
  },
)
it('resets the opening sequence on the next round while rotating the starter', () => {
  const s = openingFixture()
  const owner = s.current
  const low = [...s.players.flatMap((p) => p.hand), ...s.drawPile].sort(
    (a, b) => cardValue(a, s.indicator.rank) - cardValue(b, s.indicator.rank),
  )
  s.players[owner].hand = low.splice(0, 7)
  for (const p of s.players)
    if (p !== s.players[owner]) p.hand = low.splice(0, 7)
  s.drawPile = low
  const shown = applyAction(
    s,
    { type: 'show', playerId: s.players[owner].id },
    200,
  )
  expect(shown.phase).toBe('round-over')
  const next = applyAction(shown, { type: 'next-round' }, 300, () => 0.6)
  expect(next.round).toBe(2)
  expect(next.starter).toBe((s.starter + 1) % s.players.length)
  expect(
    next.events!.find((e) => e.type === 'ROUND_STARTED' && e.roundNumber === 2),
  ).toMatchObject({ openingCard: latestGroup(next)[0] })
  expect(['opening-draw', 'penalty', 'turn']).toContain(next.phase)
})
