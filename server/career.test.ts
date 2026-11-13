import { describe, expect, it, vi } from 'vitest'
import { createRoom, join, start, gameAction, sweep, leave, view } from './room'
import { observeCareer, syncCareer, careerOriginAllowed } from './career'
import type { Identity } from './types'
import { createCard } from '../src/game/cards'
import type { GameRank } from '../src/game/deck'
const ids = [
  'user:11111111-1111-4111-8111-111111111111',
  'user:22222222-2222-4222-8222-222222222222',
  'user:33333333-3333-4333-8333-333333333333',
]
const identity = (id: string): Identity => ({
  id,
  displayName: id === ids[0] ? 'Alex' : 'Ben',
  accountType: 'registered',
  avatarUrl: null,
  expiresAt: 1e9,
})
let serial = 0
const card = (rank: GameRank) => ({
  ...createCard('hearts', rank),
  id: `private-physical-${serial++}`,
})
function fixture(count = 2) {
  const r = createRoom(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'ABCDEF',
    identity(ids[0]),
    { maxPlayers: count, eliminationThreshold: 100, timedGame: true },
    0,
  )
  for (const id of ids.slice(1, count)) join(r, identity(id), 0)
  r.members.forEach((m) => {
    m.connected = true
    m.lastSeen = 0
  })
  start(r, ids[0], 0, () => 0.6, true)
  const g = r.game!
  g.current = 0
  g.phase = 'turn'
  g.sevens = null
  g.deadline = 60000
  g.indicator = createCard('clubs', '9')
  g.eligible = []
  g.discards = [[card('3')]]
  g.drawPile = [card('A'), card('2'), card('5')]
  g.players[0].hand = [card('Q'), card('Q'), card('7')]
  g.players[1].hand = [card('K'), card('7')]
  return r
}
describe('authoritative career observer', () => {
  it('counts multi-card drops, forced draws and complete-turn timing once', () => {
    const r = fixture()
    const idsToDrop = r.game!.players[0].hand.slice(0, 2).map((c) => c.id)
    gameAction(r, ids[0], { type: 'discard', cardIds: idsToDrop }, 3000)
    const stats = r.career!.players[0].stats
    expect(stats.cardsDropped).toBe(2)
    expect(stats.cardsDrawn).toBe(1)
    expect(stats.completedTurns).toBe(1)
    expect(stats.decisionMs).toBe(3000)
    observeCareer(r, r.game, r.game!, 3000, true)
    expect(stats.cardsDropped).toBe(2)
    expect(stats.completedTurns).toBe(1)
    expect(JSON.stringify(r.career)).not.toContain('private-physical')
  })
  it('preserves decision start time across a drop and open replacement', () => {
    const r = fixture()
    r.game!.eligible = r.game!.discards[0].map((c) => c.id)
    gameAction(
      r,
      ids[0],
      { type: 'discard', cardIds: [r.game!.players[0].hand[0].id] },
      1000,
    )
    expect(r.career!.players[0].stats.completedTurns).toBeUndefined()
    gameAction(
      r,
      ids[0],
      { type: 'draw', source: 'discard', cardId: r.game!.eligible[0] },
      4000,
    )
    expect(r.career!.players[0].stats.cardsPickedUp).toBe(1)
    expect(r.career!.players[0].stats.decisionMs).toBe(4000)
  })
  it('records validated Least outcomes, completed rounds and final score losses', () => {
    const r = fixture()
    r.game!.players[0].hand = [card('PJ')]
    r.game!.players[1].score = 99
    gameAction(r, ids[0], { type: 'show' }, 2000)
    expect(r.career!.status).toBe('completed')
    expect(r.career!.players[0].stats).toMatchObject({
      declarations: 1,
      successfulDeclarations: 1,
      zeroDeclarations: 1,
      roundsWon: 1,
      gamesWon: 1,
      gamesPlayed: 1,
    })
    expect(r.career!.players[1].stats).toMatchObject({
      scoreEliminations: 1,
      gamesLost: 1,
      roundsCompleted: 1,
    })
    expect(r.career!.rounds[0].eligibleIds).toHaveLength(2)
  })
  it('counts timeouts but not automatic actions as deliberate moves', () => {
    const r = fixture()
    sweep(r, 60001)
    expect(r.career!.players[0].stats.timeoutEliminations).toBe(1)
    expect(r.career!.players[0].stats.completedTurns).toBeUndefined()
    expect(r.career!.players[0].stats.gamesLost).toBe(1)
  })
  it('marks intentional leaving as abandonment without changing game rules', () => {
    const r = fixture()
    leave(r, ids[0], 1000)
    expect(r.career!.players[0].outcome).toBe('abandoned')
    expect(r.career!.players[0].stats.gamesAbandoned).toBe(1)
    expect(r.game!.players[0].eliminated).toBe(false)
  })
  it('keeps mixed guest games casual and ignores unaccepted actions', () => {
    const r = fixture()
    r.career!.eligible = false
    expect(() =>
      gameAction(
        r,
        ids[1],
        { type: 'discard', cardIds: [r.game!.players[1].hand[0].id] },
        1000,
      ),
    ).toThrow()
    expect(r.career!.players[1].stats.cardsDropped).toBeUndefined()
  })
})

it('acknowledges only the revision actually sent to PostgreSQL', async () => {
  const r = fixture(),
    c = r.career!,
    sent = c.revision
  let finish!: (response: Response) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  vi.stubGlobal('fetch', fetch)
  try {
    const syncing = syncCareer(c, {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_CAREER_KEY: 'sb_secret_test_server_only',
    } as import('./types').Env)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    c.revision++
    finish(
      new Response('null', { headers: { 'Content-Type': 'application/json' } }),
    )
    expect(await syncing).toBe(true)
    expect(c.syncedRevision).toBe(sent)
    expect(c.syncedRevision).toBeLessThan(c.revision)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('requires an explicit production origin and server-only configuration for rewarded starts', () => {
  const env = {
    CAREER_ENABLED: 'true',
    CAREER_ORIGIN: 'https://game.example.test',
    SUPABASE_CAREER_KEY: 'server-only',
  } as import('./types').Env
  expect(careerOriginAllowed('https://game.example.test', env)).toBe(true)
  expect(careerOriginAllowed('https://preview.game.example.test', env)).toBe(
    false,
  )
  expect(
    careerOriginAllowed('https://game.example.test', {
      ...env,
      SUPABASE_CAREER_KEY: undefined,
    }),
  ).toBe(false)
  expect(
    careerOriginAllowed('https://game.example.test', {
      ...env,
      CAREER_ENABLED: undefined,
    }),
  ).toBe(false)
})

it('counts 7 actions, physical cards, full-cycle participants and automatic penalty draws separately', () => {
  const cycle = fixture()
  for (let i = 0; i < 2; i++)
    gameAction(
      cycle,
      ids[i],
      {
        type: 'discard',
        cardIds: [cycle.game!.players[i].hand.find((c) => c.rank === '7')!.id],
      },
      1000 * (i + 1),
    )
  expect(cycle.career!.players[0].stats).toMatchObject({
    sevenActions: 1,
    sevensPlayed: 1,
    penaltiesTriggered: 1,
    fullCycles: 1,
  })
  expect(cycle.career!.players[1].stats.fullCycles).toBe(1)
  const stacked = fixture(3)
  stacked.game!.players[2].hand = [card('K')]
  for (let i = 0; i < 2; i++)
    gameAction(
      stacked,
      ids[i],
      {
        type: 'discard',
        cardIds: [
          stacked.game!.players[i].hand.find((c) => c.rank === '7')!.id,
        ],
      },
      1000 * (i + 1),
    )
  expect(stacked.career!.players[1].stats).toMatchObject({
    penaltiesStacked: 1,
    maxPenalty: 4,
  })
  expect(stacked.career!.players[2].stats).toMatchObject({
    penaltyCardsDrawn: 4,
    cardsDrawn: 4,
  })
  expect(stacked.career!.players[2].stats.completedTurns).toBeUndefined()
})
it('records failed positive-point Least declarations and actual 40-point penalties', () => {
  const r = fixture()
  r.game!.players.forEach((p) => {
    p.hand = [card('A')]
  })
  gameAction(r, ids[0], { type: 'show' }, 1000)
  expect(r.career!.players[0].stats).toMatchObject({
    declarations: 1,
    failedDeclarations: 1,
    declaredTotal: 1,
    failedDeclarationPenalty: 40,
    roundPenalties: 40,
  })
})
it('counts zero-value cards under the actual round indicator', () => {
  const r = fixture()
  r.game!.players[0].hand = [card('9'), card('Q')]
  gameAction(
    r,
    ids[0],
    { type: 'discard', cardIds: [r.game!.players[0].hand[0].id] },
    1000,
  )
  expect(r.career!.players[0].stats.zeroCardsDropped).toBe(1)
})


it.each([39, 40, 41])('propagates a successful Least with hand total %i through server views, history and career statistics', total => {
  const r = fixture(3)
  r.game!.players[0].hand = [card('A')]
  r.game!.players[1].hand = [card('8')]
  const hand = [card('K'), card('Q'), card('J')]
  hand.push(...(total === 39 ? [card('8'), card('A')] : [card('10'), ...(total === 41 ? [card('A')] : [])]))
  r.game!.players[2].hand = hand
  r.game!.players[2].score = 20
  gameAction(r, ids[0], { type: 'show' }, 1000)
  const penalty = Math.min(total, 40)
  expect(r.game!.result!.scores[2]).toMatchObject({ total, penalty, score: 20 + penalty })
  expect(r.career!.rounds[0].scores[2]).toMatchObject({ total, penalty, score: 20 + penalty })
  expect(r.career!.players[2].stats).toMatchObject({ roundPenalties: penalty, highestHand: total })
  for (const id of ids) {
    const projection = view(r, id, 1000).game!
    expect(projection.result!.scores[2]).toMatchObject({ total, penalty, score: 20 + penalty })
    expect(projection.players[2].score).toBe(20 + penalty)
  }
})

it.each([39, 40, 41])('records only the failed declarer penalty when another opponent holds %i points', total => {
  const r = fixture(3)
  r.game!.players[0].hand = [card('4')]
  r.game!.players[1].hand = [card('2')]
  r.game!.players[2].hand = [card('K'), card('Q'), card('J'), ...(total === 39 ? [card('8'), card('A')] : [card('10'), ...(total === 41 ? [card('A')] : [])])]
  r.game!.players[2].score = 99
  gameAction(r, ids[0], { type: 'show' }, 1000)
  expect(r.game!.result!.scores.map(score => score.penalty)).toEqual([40, 0, 0])
  expect(r.career!.rounds[0].scores.map(score => score.penalty)).toEqual([40, 0, 0])
  expect(r.career!.players.map(p => p.stats.roundPenalties)).toEqual([40, 0, 0])
  expect(r.career!.players[2].stats.highestHand).toBe(total)
  for (const id of ids) {
    const projection = view(r, id, 1000).game!
    expect(projection.result!.scores.map(score => score.penalty)).toEqual([40, 0, 0])
    expect(projection.players[2]).toMatchObject({ score: 99, eliminated: false })
  }
})
