import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db: PGlite
const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; grant usage on schema auth,storage to authenticated,anon,service_role;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text); alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;`)
  for (const file of [
    '202611050001_profiles.sql',
    '202611060001_avatar_limits.sql',
    '202611060002_careers.sql',
  ])
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        'utf8',
      ),
    )
}, 60_000)
afterAll(async () => {
  await db?.close()
})
beforeEach(async () => {
  await db.exec(
    'reset role; truncate public.career_matches cascade; truncate auth.users cascade;',
  )
  for (const [i, id] of ids.entries())
    await db.query(
      'insert into auth.users(id,email_confirmed_at) values($1,now());',
      [id],
    )
  for (const [i, id] of ids.entries())
    await db.query(
      'insert into public.profiles(id,display_name) values($1,$2)',
      [id, `Player ${i + 1}`],
    )
})
async function rpc(
  op: string,
  args: unknown = {},
  who: string | null = ids[0],
) {
  await db.exec('reset role')
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",
    [who ?? ''],
  )
  await db.exec(who ? 'set role authenticated' : 'set role anon')
  const result = await db.query<{ result: any }>(
    'select public.career_api($1,$2::jsonb) as result',
    [op, JSON.stringify(args)],
  )
  return result.rows[0].result
}
describe('PostgreSQL metagame permissions and transactions', () => {
  it('applies all migrations and limits avatar uploads to 5 MB', async () => {
    expect(
      (
        await db.query<{ file_size_limit: number }>(
          'select file_size_limit from storage.buckets',
        )
      ).rows[0].file_size_limit,
    ).toBe(5242880)
  })
  it('exposes safe public profiles and keeps detailed data owner-only', async () => {
    const me = await rpc('profile')
    expect(me.own).toBe(true)
    expect(me.statistics).toEqual({})
    const other = await rpc('public', {
      username: `lc_${ids[1].replaceAll('-', '')}`,
    })
    expect(other.own).toBe(false)
    expect(other.statistics).toBeUndefined()
    expect(other.games).toBeUndefined()
    expect(JSON.stringify(other)).not.toContain('email')
  })
  it('prevents direct client statistics, XP and relationship writes', async () => {
    await rpc('profile')
    await expect(
      db.query('insert into public.career_totals(user_id,xp) values($1,9999)', [
        ids[0],
      ]),
    ).rejects.toThrow(/permission/)
    await expect(
      db.query('insert into public.buddy_relationships values($1,$2,now())', [
        ids[0],
        ids[1],
      ]),
    ).rejects.toThrow(/permission/)
    await expect(
      db.query("select public.ingest_career_match('{}')"),
    ).rejects.toThrow(/permission/)
  })
  it('handles requests, reversed duplicates, recipient-only acceptance, remove and block', async () => {
    await expect(
      rpc('relationship', { id: ids[0], action: 'request' }),
    ).rejects.toThrow(/another registered/)
    expect(
      (await rpc('relationship', { id: ids[1], action: 'request' }))
        .relationship,
    ).toBe('outgoing')
    await expect(
      rpc('relationship', { id: ids[0], action: 'request' }, ids[1]),
    ).rejects.toThrow(/already exists/)
    await expect(
      rpc('relationship', { id: ids[1], action: 'accept' }),
    ).rejects.toThrow(/unavailable/)
    expect(
      (await rpc('relationship', { id: ids[0], action: 'accept' }, ids[1]))
        .relationship,
    ).toBe('accepted')
    expect((await rpc('buddies')).players).toHaveLength(1)
    await rpc('relationship', { id: ids[1], action: 'remove' })
    await rpc('relationship', { id: ids[1], action: 'block' })
    await expect(
      rpc('relationship', { id: ids[0], action: 'request' }, ids[1]),
    ).rejects.toThrow(/unavailable/)
    expect(
      (await rpc('leaderboard')).players.map((p: any) => p.id),
    ).not.toContain(ids[1])
    await rpc('relationship', { id: ids[1], action: 'unblock' })
    expect(
      (await rpc('relationship', { id: ids[1], action: 'request' }))
        .relationship,
    ).toBe('outgoing')
    await rpc('relationship', { id: ids[1], action: 'cancel' })
    expect((await rpc('buddies')).players).toHaveLength(0)
  })
  it('ranks deterministically and excludes pending players from buddies ranking', async () => {
    const global = await rpc('leaderboard')
    expect(global.players.map((p: any) => p.id)).toEqual(ids)
    await rpc('relationship', { id: ids[1], action: 'request' })
    expect(
      (await rpc('leaderboard', { scope: 'buddies' })).players,
    ).toHaveLength(1)
    await rpc('relationship', { id: ids[0], action: 'accept' }, ids[1])
    expect(
      (await rpc('leaderboard', { scope: 'buddies' })).players,
    ).toHaveLength(2)
  })
})

const gameId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function report(roundCount = 5) {
  return {
    id: gameId,
    eligible: true,
    revision: 7,
    startedAt: 1000,
    completedAt: 120000,
    status: 'completed',
    settings: { timedGame: true, eliminationThreshold: 100 },
    players: ids.slice(0, 2).map((id, i) => ({
      id: `user:${id}`,
      name: `Player ${i + 1}`,
      score: i ? 100 : 20,
      rank: i + 1,
      outcome: i ? 'lost' : 'won',
      stats: {
        gamesStarted: 1,
        gamesPlayed: 1,
        gamesWon: i ? 0 : 1,
        gamesLost: i ? 1 : 0,
        roundsPlayed: roundCount,
        roundsCompleted: roundCount,
        playingMs: 119000,
        completedTurns: 3,
        decisionMs: 9000,
        fastestMs: 1000,
        slowestMs: 5000,
      },
    })),
    rounds: Array.from({ length: roundCount }, (_, i) => ({
      round: i + 1,
      at: 10000 + i * 1000,
      reason: 'show',
      successful: true,
      caller: `user:${ids[0]}`,
      eligibleIds: ids.slice(0, 2).map((id) => `user:${id}`),
      scores: ids.slice(0, 2).map((id, j) => ({
        id: `user:${id}`,
        name: `Player ${j + 1}`,
        total: j ? 20 : 0,
        penalty: j ? 20 : 0,
        score: j ? 20 * (i + 1) : 0,
      })),
    })),
  }
}
async function ingest(value: unknown) {
  await db.exec('reset role')
  await db.query(
    "select set_config('request.jwt.claim.role','service_role',false)",
  )
  await db.exec('set role service_role')
  await db.query('select public.ingest_career_match($1::jsonb)', [
    JSON.stringify(value),
  ])
}
describe('transactional career results and XP', () => {
  it('awards 150 XP for five rounds plus victory exactly once, including stale/final replays', async () => {
    const value = report()
    await ingest(value)
    const winner = await rpc('profile')
    expect(winner.profile.xp).toBe(150)
    expect(winner.opponents[0]).toMatchObject({
      id: ids[1],
      gamesTogether: 1,
      wins: 1,
      losses: 0,
    })
    expect(winner.statistics.gamesWon).toBe(1)
    expect(winner.statistics.currentWinStreak).toBe(1)
    expect(
      winner.statistics.decisionMs / winner.statistics.completedTurns,
    ).toBe(3000)
    await ingest(value)
    await ingest({ ...value, revision: 6 })
    await ingest({ ...value, revision: 8 })
    expect((await rpc('profile')).profile.xp).toBe(150)
    expect((await rpc('profile', {}, ids[1])).profile.xp).toBe(75)
    const ranking = await rpc('leaderboard')
    expect(ranking.players[0].id).toBe(ids[0])
    const reportData = await rpc('game', { game: gameId })
    expect(reportData.players[0].stats.completedTurns).toBe(3)
    expect(reportData.players[1].stats).toEqual({})
    await expect(rpc('game', { game: gameId }, ids[2])).rejects.toThrow(
      /unavailable/,
    )
  })
  it('awards 65 XP for four completed rounds and a loss; rejected casual reports award nothing', async () => {
    await expect(ingest({ ...report(4), eligible: false })).rejects.toThrow(
      /Invalid career/,
    )
    expect((await rpc('profile')).profile.xp).toBe(0)
    await ingest(report(4))
    const loser = await rpc('profile', {}, ids[1])
    expect(loser.profile.xp).toBe(65)
    expect(loser.statistics.gamesPlayed).toBe(1)
    expect(loser.statistics.gamesLost).toBe(1)
  })
  it('keeps earlier round XP for an abandoning player but gives no final bonus or loss', async () => {
    const value = report(4)
    value.players[1].outcome = 'abandoned'
    value.players[1].stats = {
      ...value.players[1].stats,
      gamesPlayed: 0,
      gamesLost: 0,
      gamesAbandoned: 1,
    } as (typeof value.players)[1]['stats']
    await ingest(value)
    const player = await rpc('profile', {}, ids[1])
    expect(player.profile.xp).toBe(40)
    expect(player.statistics.gamesAbandoned).toBe(1)
    expect(player.statistics.gamesLost).toBe(0)
  })
  it('never exposes detailed profile data to anon and protects username changes', async () => {
    await expect(rpc('profile', {}, null)).rejects.toThrow(/Registered account/)
    await rpc('profile')
    await expect(
      db.query('update public.profiles set username=$1 where id=$2', [
        'impersonator',
        ids[0],
      ]),
    ).rejects.toThrow(/permission/)
  })
  it('handles decline and forbids cancellation by a third party', async () => {
    await rpc('relationship', { id: ids[1], action: 'request' })
    await expect(
      rpc('relationship', { id: ids[0], action: 'cancel' }, ids[2]),
    ).rejects.toThrow(/unavailable/)
    await rpc('relationship', { id: ids[0], action: 'decline' }, ids[1])
    expect((await rpc('buddies')).players).toHaveLength(0)
  })
})

it('keeps absolute global ranks stable when a higher-ranked player is blocked', async () => {
  const prior = await rpc('profile', {}, ids[2])
  expect(prior.profile.rank).toBe(3)
  await rpc('relationship', { id: ids[0], action: 'block' }, ids[2])
  const ranking = await rpc('leaderboard', {}, ids[2])
  expect(ranking.me.rank).toBe(3)
  expect(ranking.players.map((p: any) => p.id)).not.toContain(ids[0])
})
it('does not create public profiles for unverified or anonymous auth users', async () => {
  const unverified = '44444444-4444-4444-8444-444444444444'
  await db.query(
    'insert into auth.users(id,email_confirmed_at) values($1,null)',
    [unverified],
  )
  await expect(
    db.query(
      "insert into public.profiles(id,display_name) values($1,'Unverified')",
      [unverified],
    ),
  ).rejects.toThrow(/Verified account/)
})
it('paginates rankings while retaining the current player outside the first page', async () => {
  for (let i = 4; i <= 15; i++) {
    const id = `${String(i).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
    await db.query(
      'insert into auth.users(id,email_confirmed_at) values($1,now())',
      [id],
    )
    await db.query(
      "insert into public.profiles(id,display_name) values($1,'Extra Player')",
      [id],
    )
  }
  const first = await rpc('leaderboard')
  expect(first.players).toHaveLength(10)
  expect(first.me.rank).toBeGreaterThan(10)
  expect(first.more).toBe(true)
  expect(first.me.id).toBe(ids[0])
  const second = await rpc('leaderboard', { offset: 10 })
  expect(second.players).toHaveLength(5)
  expect(second.more).toBe(false)
  expect(
    new Set([...first.players, ...second.players].map((p: any) => p.id)).size,
  ).toBe(15)
})

it('breaks a win streak on explicit abandonment even while the next room remains active', async () => {
  await ingest(report())
  expect((await rpc('profile')).statistics.currentWinStreak).toBe(1)
  const value = {
    ...report(0),
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status: 'active',
    startedAt: 200000,
    completedAt: null,
    revision: 1,
    players: ids.slice(0, 2).map((id, i) => ({
      id: `user:${id}`,
      name: 'Player',
      score: 0,
      rank: null,
      outcome: i ? 'active' : 'abandoned',
      abandonedAt: i ? undefined : 210000,
      stats: { gamesStarted: 1, gamesAbandoned: i ? 0 : 1 },
    })),
  }
  await ingest(value)
  const stats = (await rpc('profile')).statistics
  expect(stats.currentWinStreak).toBe(0)
  expect(stats.bestWinStreak).toBe(1)
})

it('counts a shared third-player victory without inventing a head-to-head win or loss', async () => {
  const value = report(0)
  value.players.forEach((p, i) => {
    p.outcome = 'lost'
    p.stats.gamesWon = 0
    p.stats.gamesLost = 1
    p.rank = i + 2
  })
  value.players.push({
    ...value.players[0],
    id: `user:${ids[2]}`,
    name: 'Third winner',
    outcome: 'won',
    rank: 1,
    stats: { ...value.players[0].stats, gamesWon: 1, gamesLost: 0 },
  })
  await ingest(value)
  const owner = await rpc('profile')
  expect(owner.opponents.find((p: any) => p.id === ids[1])).toMatchObject({
    gamesTogether: 1,
    wins: 0,
    losses: 0,
  })
  expect(owner.opponents.find((p: any) => p.id === ids[2])).toMatchObject({
    gamesTogether: 1,
    wins: 0,
    losses: 1,
  })
})
it('searches display-name prefixes and treats wildcards as literal input', async () => {
  expect(await rpc('search', { query: 'Player' })).toHaveLength(3)
  expect(await rpc('search', { query: '%%' })).toHaveLength(0)
})

it('merges acknowledged round packets into complete history while preserving unique rewards', async () => {
  const full = report(2)
  const early = {
    ...full,
    revision: 1,
    status: 'active',
    completedAt: null,
    rounds: full.rounds.slice(0, 1),
    players: full.players.map((p) => ({
      ...p,
      outcome: 'active',
      stats: { gamesStarted: 1, roundsPlayed: 1, roundsCompleted: 1 },
    })),
  }
  await ingest(early)
  await ingest({ ...early, revision: 2, rounds: [] })
  const later = { ...full, revision: 3, rounds: full.rounds.slice(1) }
  await ingest(later)
  const game = await rpc('game', { game: gameId })
  expect(game.rounds).toHaveLength(2)
  expect((await rpc('profile')).profile.xp).toBe(120)
})
