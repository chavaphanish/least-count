import { describe, expect, it } from 'vitest'
import { createCard } from './cards'
import {
  applyAction,
  canShow,
  createGame,
  latestGroup,
  normalizeLegacyTurn,
  pickupCards,
  TURN_MS,
} from './engine'
import type { Action, GameState } from './engine'
import { cardValue, handTotal } from './deck'
import { isSavedGame, loadSession } from '../lib/session'
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
function fixture(
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
    if ((latestGroup(s)[0].rank === '7') !== seven) continue
    if (s.players[s.starter].hand.some((c) => c.rank === '7') !== hasSeven)
      continue
    if (seven && hasSeven && s.phase !== 'penalty') continue
    return s
  }
  throw new Error('No matching opening')
}
const allCards = (s: GameState) => [
  ...s.players.flatMap((p) => p.hand),
  ...s.drawPile,
  ...s.discards.flat(),
  s.indicator,
]
function discard(s: GameState, ids?: string[], now = 200) {
  const p = s.players[s.current]
  return applyAction(
    s,
    {
      type: 'discard',
      playerId: p.id,
      cardIds: ids ?? [
        p.hand.find(
          (c) => c.rank !== '7' && c.rank !== latestGroup(s)[0]?.rank,
        )!.id,
      ],
    },
    now,
  )
}
function draw(s: GameState, source: 'pile' | 'discard', now = 300) {
  return applyAction(
    s,
    {
      type: 'draw',
      playerId: s.players[s.current].id,
      source,
      cardId: source === 'discard' ? pickupCards(s)[0]?.id : undefined,
    },
    now,
  )
}
describe('standard discard-first opening', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'starts in the ordinary discard phase with seven cards (%i players)',
    (count) => {
      const s = fixture(false, true, true, count)
      const p = s.players[s.current]
      expect(s.phase).toBe('turn')
      expect(s.players.every((p) => p.hand.length === 7)).toBe(true)
      expect(s.eligible).toEqual([latestGroup(s)[0].id])
      expect(s.events![0]).toMatchObject({
        type: 'ROUND_STARTED',
        openingCard: latestGroup(s)[0],
      })
      expect(() => draw(s, 'pile')).toThrow(/Drop first/)
      expect(() => draw(s, 'discard')).toThrow(/Drop first/)
      expect(() =>
        applyAction(
          s,
          {
            type: 'opening-draw',
            playerId: p.id,
            source: 'pile',
          } as unknown as Action,
          200,
        ),
      ).toThrow(/not available/)
      expect(new Set(allCards(s).map((c) => c.id)).size).toBe(
        count <= 4 ? 53 : 106,
      )
    },
  )
  it.each(['pile', 'discard'] as const)(
    'discards before taking one replacement from %s, preserving the old eligible card',
    (source) => {
      const s = fixture()
      const owner = s.current
      const opener = latestGroup(s)[0]
      const hidden = s.drawPile.at(-1)!
      const before = allCards(s)
        .map((c) => c.id)
        .sort()
      const discarded = s.players[owner].hand.find(
        (c) => c.rank !== '7' && c.rank !== opener.rank,
      )!
      const waiting = discard(s, [discarded.id])
      expect(waiting.phase).toBe('draw')
      expect(waiting.current).toBe(owner)
      expect(waiting.players[owner].hand).toHaveLength(6)
      expect(latestGroup(waiting)).toEqual([discarded])
      expect(pickupCards(waiting)).toEqual([opener])
      expect(waiting.drawPile).toEqual(s.drawPile)
      expect(waiting.deadline).toBe(s.deadline)
      expect(canShow(waiting, s.players[owner].id)).toBe(false)
      expect(() =>
        applyAction(
          waiting,
          {
            type: 'draw',
            playerId: s.players[owner].id,
            source: 'discard',
            cardId: discarded.id,
          },
          300,
        ),
      ).toThrow(/preceding/)
      const done = draw(waiting, source)
      expect(done.players[owner].hand).toHaveLength(7)
      expect(done.current).not.toBe(owner)
      expect(done.phase).toBe('turn')
      expect(done.deadline).toBe(300 + TURN_MS)
      expect(done.players[owner].hand).toContainEqual(
        source === 'discard' ? opener : hidden,
      )
      expect(done.discards.flat().some((c) => c.id === opener.id)).toBe(
        source === 'pile',
      )
      expect(latestGroup(done)).toEqual([discarded])
      expect(done.drawPile.length).toBe(
        s.drawPile.length - (source === 'pile' ? 1 : 0),
      )
      expect(
        allCards(done)
          .map((c) => c.id)
          .sort(),
      ).toEqual(before)
      expect(() => draw(done, source)).toThrow()
      if (source === 'pile')
        expect(JSON.stringify(done.events!.at(-1))).not.toContain(hidden.id)
    },
  )
  it('recognizes opening Match and Drop without forcing a matching card to be played', () => {
    const s = fixture()
    s.discards = [[{ ...createCard('hearts', '9'), id: 'opening-9' }]]
    s.eligible = ['opening-9']
    s.players[s.current].hand = [
      { ...createCard('spades', '9'), id: 'nine-a' },
      { ...createCard('diamonds', '9'), id: 'nine-b' },
      { ...createCard('clubs', 'K'), id: 'king' },
    ]
    const drop = discard(s, ['nine-a', 'nine-b'])
    expect(drop.current).not.toBe(s.current)
    expect(drop.players[s.current].hand).toHaveLength(1)
    expect(drop.drawPile).toEqual(s.drawPile)
    const normal = discard(s, ['king'])
    expect(normal.phase).toBe('draw')
    expect(pickupCards(normal)).toEqual(s.discards[0])
  })
  it('a first-player 7 immediately starts the standard penalty without replacement or opening pickup', () => {
    const s = fixture()
    const player = s.players[s.current]
    const sevens = player.hand.filter((c) => c.rank === '7')
    const done = discard(
      s,
      sevens.map((c) => c.id),
    )
    expect(done.players[s.current].hand).toHaveLength(7 - sevens.length)
    expect(
      done.events!.some(
        (e) => e.type === 'POWER_SEVEN_PLAYED' && e.penalty === 2,
      ),
    ).toBe(true)
    expect(done.phase).not.toBe('draw')
  })
  it.each([true, false])(
    'keeps the same deadline through discard and reconnect (timed=%s)',
    (timed) => {
      const s = fixture(false, true, timed)
      const waiting = discard(s)
      expect(waiting.deadline).toBe(timed ? 60100 : null)
      expect(isSavedGame(waiting)).toBe(true)
      expect(isSavedGame(JSON.parse(JSON.stringify(waiting)))).toBe(true)
      if (timed)
        for (const state of [s, waiting]) {
          const done = applyAction(state, { type: 'timeout' }, 60100)
          expect(done.players[s.current]).toMatchObject({ forfeited: true, eliminated: false, score: 40 })
        }
    },
  )
  it('preserves Show at the start and rejects it after the first discard', () => {
    const s = fixture()
    const owner = s.current
    const pool = [...s.players.flatMap((p) => p.hand), ...s.drawPile].sort(
      (a, b) => cardValue(a, s.indicator.rank) - cardValue(b, s.indicator.rank),
    )
    s.players[owner].hand = pool.splice(0, 7)
    for (const p of s.players)
      if (p !== s.players[owner]) p.hand = pool.splice(0, 7)
    s.drawPile = pool
    expect(
      handTotal(s.players[owner].hand, s.indicator.rank),
    ).toBeLessThanOrEqual(5)
    expect(canShow(s, s.players[owner].id)).toBe(true)
    const shown = applyAction(
      s,
      { type: 'show', playerId: s.players[owner].id },
      200,
    )
    expect(shown.result!.reason).toBe('show')
    const waiting = discard(s)
    expect(canShow(waiting, s.players[owner].id)).toBe(false)
    expect(() =>
      applyAction(
        waiting,
        { type: 'show', playerId: s.players[owner].id },
        300,
      ),
    ).toThrow()
    let round = shown
    for (let i = 2; i <= 4; i++) {
      round = applyAction(round, { type: 'next-round' }, i * 300, () => 0.6)
      expect(round.round).toBe(i)
      expect(['turn', 'penalty']).toContain(round.phase)
      if (latestGroup(round)[0].rank !== '7')
        expect(round.eligible).toEqual([latestGroup(round)[0].id])
      // Create a low hand only to finish this test round; dealing itself is tested with real cards.
      round.players.forEach((p) => {
        p.hand = []
        p.score = 0
      })
      round.phase = 'turn'
      round.sevens = null
      round = applyAction(
        round,
        { type: 'show', playerId: round.players[round.current].id },
        i * 300 + 1,
      )
    }
  })
  it.each(['printed', 'selected'])(
    'preserves eligible %s Joker opening pickup after a discard',
    (kind) => {
      let s: GameState | undefined
      for (let seed = 0; seed < 3000; seed++) {
        const candidate = createGame(['A', 'B'], 100, seeded(seed))
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
      const opener = latestGroup(s!)[0]
      const done = draw(discard(s!), 'discard')
      expect(done.players[s!.current].hand).toContainEqual(opener)
      expect(new Set(allCards(done).map((c) => c.id)).size).toBe(53)
    },
  )
})
describe('opening 7 remains a penalty', () => {
  it.each([true, false])(
    'retains response/acceptance and excludes normal actions (timed=%s)',
    (timed) => {
      const s = fixture(true, true, timed)
      const p = s.players[s.current]
      expect(s.sevens).toMatchObject({
        amount: 2,
        participants: [],
        initiator: s.starter,
        opening: true,
      })
      expect(isSavedGame(s)).toBe(true)
      expect(canShow(s, p.id)).toBe(false)
      expect(() => draw(s, 'discard')).toThrow()
      expect(() =>
        applyAction(s, { type: 'show', playerId: p.id }, 200),
      ).toThrow()
      expect(() =>
        discard(s, [p.hand.find((c) => c.rank !== '7')!.id]),
      ).toThrow()
      const accepted = applyAction(
        s,
        { type: 'accept-penalty', playerId: p.id },
        200,
      )
      expect(accepted.players[s.current].hand).toHaveLength(9)
      expect(accepted.sevens).toBeNull()
      expect(accepted.phase).toBe('turn')
      const response = discard(
        s,
        p.hand.filter((c) => c.rank === '7').map((c) => c.id),
      )
      expect(
        response.events!.some(
          (e) => e.type === 'POWER_SEVEN_PLAYED' && e.penalty === 4,
        ),
      ).toBe(true)
    },
  )
  it('automatically draws two and skips an opener with no 7', () => {
    const s = fixture(true, false)
    expect(s.players[s.starter].hand).toHaveLength(9)
    expect(s.phase).toBe('turn')
    expect(s.current).not.toBe(s.starter)
    expect(s.events!.map((e) => e.type)).toEqual([
      'ROUND_STARTED',
      'OPENING_SEVEN_ACTIVATED',
      'POWER_SEVEN_PENALTY_DRAWN',
    ])
  })
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'preserves the full-cycle state machine for %i seats',
    (count) => {
      // Synthetic response hands exercise tracking; unchanged physical decks cannot supply an opening cycle at 4/8.
      let s = fixture(true, true, true, count)
      const first = s.current
      s.players.forEach((p, i) => {
        p.hand = [{ ...createCard('clubs', '7'), id: `response-${i}` }]
      })
      for (let i = 0; i < count; i++) {
        s = discard(s, [s.players[s.current].hand[0].id])
        if (i < count - 1) expect(s.sevens!.participants).toHaveLength(i + 1)
      }
      expect(s.sevens).toBeNull()
      expect(s.phase).toBe('turn')
      expect(s.current).toBe(first)
      expect(s.eligible).toEqual([])
      expect(pickupCards(s)).toEqual([])
    },
  )
})
describe('one-time compatibility with retired opening phases', () => {
  it.each([false, true])(
    'preserves owned cards and the deadline when restoring old saves (already acquired=%s)',
    (acquired) => {
      const original = fixture()
      const s = structuredClone(original)
      const owner = s.current
      if (acquired) {
        s.players[owner].hand.push(s.discards[0][0])
        s.discards = []
        s.eligible = []
      }
      ;(s as unknown as { phase: string }).phase = acquired
        ? 'opening-discard'
        : 'opening-draw'
      const encoded = JSON.stringify(s)
      const loaded = loadSession({
        getItem: () => encoded,
        setItem: () => {},
        removeItem: () => {},
      })!
      expect(loaded.phase).toBe('turn')
      expect(loaded.players[owner].hand).toEqual(s.players[owner].hand)
      expect(loaded.deadline).toBe(original.deadline)
      expect(normalizeLegacyTurn(loaded)).toBe(loaded)
      if (acquired) {
        expect(canShow(loaded, loaded.players[owner].id)).toBe(false)
        const done = discard(loaded)
        expect(done.players[owner].hand).toHaveLength(7)
        expect(done.drawPile).toEqual(s.drawPile)
        expect(done.legacyOpeningDrawn).toBeUndefined()
      } else expect(discard(loaded).phase).toBe('draw')
    },
  )
})
