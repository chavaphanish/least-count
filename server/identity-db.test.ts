import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db: PGlite
const first = '11111111-1111-4111-8111-111111111111',
  second = '22222222-2222-4222-8222-222222222222',
  legacyWithoutProfile = '33333333-3333-4333-8333-333333333333'
const fresh = '44444444-4444-4444-8444-444444444444',
  other = '55555555-5555-4555-8555-555555555555',
  game = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const tables = [
  'auth.users',
  'public.career_totals',
  'public.career_matches',
  'public.career_match_players',
  'public.career_opponents',
  'public.xp_transactions',
  'public.buddy_requests',
  'public.buddy_relationships',
  'public.player_blocks',
]
let before: unknown[]
async function snapshot() {
  return Promise.all(
    tables.map((t) =>
      db.query(
        `select row_to_json(t) as row from ${t} t order by row_to_json(t)::text`,
      ),
    ),
  )
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;grant usage on schema auth,storage to authenticated,anon,service_role;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;`)
  for (const name of [
    '202611050001_profiles.sql',
    '202611060001_avatar_limits.sql',
    '202611060002_careers.sql',
  ])
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        'utf8',
      ),
    )
  for (const id of [first, second, legacyWithoutProfile])
    await db.query(
      'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
      [id, `${id}@example.test`],
    )
  await db.query(
    'insert into public.profiles(id,display_name) values($1,$2),($3,$4)',
    [first, 'CardMaster99', second, 'Phanish Chava'],
  )
  // Existing private fields must never be overwritten by ADD COLUMN/backfill.
  await db.exec(
    "alter table public.profiles add first_name text not null default '';alter table public.profiles add last_name text not null default '';",
  )
  await db.query(
    'update public.profiles set first_name=$1,last_name=$2 where id=$3',
    ['Élodie', 'O’Neill', second],
  )
  await db.query(
    'insert into public.career_totals(user_id,xp,metrics) values($1,1250,\'{"gamesWon":18}\')',
    [first],
  )
  await db.query(
    "insert into public.career_matches values($1,1,now(),now(),'completed','{}')",
    [game],
  )
  await db.query(
    "insert into public.career_match_players(game_id,user_id,outcome,score,metrics) values($1,$2,'won',0,'{}')",
    [game, first],
  )
  await db.query(
    'insert into public.career_opponents(user_id,opponent_id,games,last_game) values($1,$2,3,now())',
    [first, second],
  )
  await db.query(
    "insert into public.xp_transactions(user_id,game_id,event_type,xp_amount,xp_before,xp_after) values($1,$2,'victory',75,1175,1250)",
    [first, game],
  )
  await db.query('insert into public.buddy_relationships values($1,$2,now())', [
    first,
    second,
  ])
  before = await snapshot()
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/202611100001_signup_identity.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 60000)
afterAll(async () => {
  await db?.close()
})
beforeEach(async () => {
  await db.exec('begin')
})
afterEach(async () => {
  await db.exec('rollback;reset role')
})
async function role(id: string | null) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id ?? '',
  ])
  await db.exec(id ? 'set role authenticated' : 'set role anon')
}
async function signup(
  id: string,
  handle: string,
  firstName = '李 Anne',
  lastName = 'D’Arcy-Smith',
) {
  return db.query(
    'insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',
    [
      id,
      JSON.stringify({
        username: handle,
        first_name: firstName,
        last_name: lastName,
      }),
    ],
  )
}
describe('non-destructive identity migration and database enforcement', () => {
  it('preserves auth IDs, every career/social/history row, old display names and existing private information', async () => {
    expect(await snapshot()).toEqual(before)
    const rows = (
      await db.query<{
        id: string
        username: string
        display_name: string
        first_name: string
        last_name: string
        needs_profile_completion: boolean
      }>('select * from public.profiles order by id')
    ).rows
    expect(rows[0]).toMatchObject({
      id: first,
      username: 'cardmaster99',
      display_name: 'CardMaster99',
      first_name: '',
      last_name: '',
      needs_profile_completion: true,
    })
    expect(rows[1]).toMatchObject({
      id: second,
      display_name: 'Phanish Chava',
      first_name: 'Élodie',
      last_name: 'O’Neill',
      needs_profile_completion: true,
    })
    expect(rows[1].username).toMatch(/^[a-z0-9]{8,24}$/)
    expect(new Set(rows.map((r) => r.username)).size).toBe(2)
  })
  it('legacy verified users can log in without new personal fields, including a user with no old profile', async () => {
    await role(first)
    expect(
      (
        await db.query('select * from public.ensure_player_profile($1)', [
          'Ignored',
        ])
      ).rows,
    ).toHaveLength(1)
    await db.exec('reset role')
    await role(legacyWithoutProfile)
    expect(
      (
        await db.query<{ needs_profile_completion: boolean }>(
          'select * from public.ensure_player_profile($1)',
          ['Old Player'],
        )
      ).rows[0].needs_profile_completion,
    ).toBe(true)
  })
  it('creates identity atomically with a pending email account and reserves case-insensitive usernames', async () => {
    await signup(fresh, 'CardPlayer123')
    await db.exec('savepoint duplicate')
    await expect(signup(other, 'CARDPLAYER123')).rejects.toThrow(/unique/)
    await db.exec('rollback to duplicate')
    expect(
      (await db.query('select id from auth.users where id=$1', [other])).rows,
    ).toHaveLength(0)
    const row = (
      await db.query('select * from public.profiles where id=$1', [fresh])
    ).rows[0]
    expect(row).toMatchObject({
      username: 'cardplayer123',
      first_name: '李 Anne',
      last_name: 'D’Arcy-Smith',
      needs_profile_completion: false,
    })
    await role(null)
    expect(
      (
        await db.query<{ available: boolean }>(
          'select public.player_username_available($1) available',
          ['CARDPLAYER123'],
        )
      ).rows[0].available,
    ).toBe(false)
  })
  it.each(['short', 'player_name', 'my player', 'player@123', 'x'.repeat(25)])(
    'rejects invalid signup metadata without leaving an auth account: %s',
    async (handle) => {
      await expect(signup(fresh, handle)).rejects.toThrow(/letters and numbers/)
    },
  )
  it.each(['', ' '.repeat(2), 'x'.repeat(81), 'Bad\nName'])(
    'requires safe personal names for new accounts: %j',
    async (name) => {
      await expect(signup(fresh, 'ValidUser123', name)).rejects.toThrow(/name/)
    },
  )
  it('protects private names and prevents direct username updates while allowing owner completion', async () => {
    const columns = (
      await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_name='career_public_profiles'",
      )
    ).rows.map((r) => r.column_name)
    expect(columns).not.toContain('first_name')
    expect(columns).not.toContain('last_name')
    await role(first)
    expect((await db.query('select id from public.profiles')).rows).toEqual([
      { id: first },
    ])
    await db.exec('savepoint unauthorized')
    await expect(
      db.query(
        "update public.profiles set username='stolenname99' where id=$1",
        [first],
      ),
    ).rejects.toThrow(/permission/)
    await db.exec('rollback to unauthorized')
    await db.query('select public.update_player_identity($1,$2,$3)', [
      'NewHandle123',
      '  José María  ',
      '  O’Neill  ',
    ])
    expect(
      (
        await db.query(
          'select username,first_name,last_name,needs_profile_completion from public.profiles',
        )
      ).rows[0],
    ).toEqual({
      username: 'newhandle123',
      first_name: 'José María',
      last_name: 'O’Neill',
      needs_profile_completion: false,
    })
    await db.exec('reset role')
    expect(
      (
        await db.query('select first_name from public.profiles where id=$1', [
          second,
        ])
      ).rows[0],
    ).toEqual({ first_name: 'Élodie' })
  })
})

it('safely resolves case-insensitive conflicts in existing legacy display names',async()=>{
 const collision=new PGlite()
 try {
  await collision.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
    create table public.profiles(id uuid primary key references auth.users,display_name text not null,avatar_path text,created_at timestamptz default now(),last_active_at timestamptz default now(),username text not null);
    create unique index profiles_username_unique on public.profiles(username);`)
  await collision.query('insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now())',[first,second])
  await collision.query("insert into public.profiles(id,display_name,username) values($1,'Duplicate99','old_a'),($2,'DUPLICATE99','old_b')",[first,second])
  await collision.exec(readFileSync(new URL('../supabase/migrations/202611100001_signup_identity.sql',import.meta.url),'utf8'))
  const rows=(await collision.query<{id:string;username:string;display_name:string}>('select id,username,display_name from public.profiles order by id')).rows
  expect(rows.map(r=>r.id)).toEqual([first,second]);expect(rows.map(r=>r.display_name)).toEqual(['Duplicate99','DUPLICATE99'])
  expect(new Set(rows.map(r=>r.username.toLowerCase())).size).toBe(2)
  for(const row of rows)expect(row.username).toMatch(/^[a-z0-9]{8,24}$/)
 } finally {await collision.close()}
})
