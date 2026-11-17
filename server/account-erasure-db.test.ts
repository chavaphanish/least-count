import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db:PGlite
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',game='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;create schema storage;grant usage on schema auth,storage to authenticated,anon,service_role;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
    grant insert,update,delete,select on storage.objects to authenticated;`)
  for(const file of ['202611050001_profiles.sql','202611060001_avatar_limits.sql','202611060002_careers.sql','202611170001_account_erasure.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))
},60000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
  await db.exec('reset role;truncate public.career_matches cascade;truncate auth.users cascade;truncate public.account_erasure_markers;truncate storage.objects;')
  for(const id of [owner,other]){await db.query('insert into auth.users(id,email_confirmed_at)values($1,now())',[id]);await db.query('insert into public.profiles(id,display_name)values($1,$2)',[id,id===owner?'Secret Owner':'Other Player'])}
  await db.query("select set_config('request.jwt.claim.role','service_role',false),set_config('request.jwt.claim.sub',$1,false)",[owner])
})
const report=(revision=1)=>({id:game,revision,eligible:true,startedAt:1000,completedAt:null,status:'active',settings:{eliminationThreshold:100,timedGame:true},rounds:[],players:[{id:`user:${owner}`,name:'Secret Owner',username:'secretowner99',firstName:'Secret',lastName:'Owner',avatarUrl:`/${owner}/photo.png`,score:40,rank:null,outcome:'active',stats:{gamesStarted:1}},{id:`user:${other}`,name:'Other Player',score:0,rank:null,outcome:'active',stats:{gamesStarted:1,cardsDrawn:revision}}]})
async function mark(){await db.query("update auth.users set raw_app_meta_data=jsonb_build_object('account_deletion_pending',true) where id=$1",[owner]);await db.query('select public.prepare_account_erasure($1)',[owner])}
it('requires the service role and a pending account; clients cannot erase another identity',async()=>{
  await expect(db.query('select public.prepare_account_erasure($1)',[owner])).rejects.toThrow(/authorized/)
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.role','authenticated',false)")
  await expect(db.query('select public.prepare_account_erasure($1)',[other])).rejects.toThrow(/permission/)
  await expect(db.query('select public.anonymize_account_history($1)',[other])).rejects.toThrow(/permission/)
  await expect(db.query('select * from public.account_erasure_markers')).rejects.toThrow(/permission/)
})
it('blocks concurrent owner avatar uploads after marking deletion, while other accounts remain usable',async()=>{
  await mark();await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.role','authenticated',false)")
  await expect(db.query("insert into storage.objects values(gen_random_uuid(),'avatars',$1)",[`${owner}/race.png`])).rejects.toThrow(/row-level security/)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other])
  await db.query("insert into storage.objects values(gen_random_uuid(),'avatars',$1)",[`${other}/safe.png`])
})
it('anonymizes history and stale reports while preserving other players and cascading only owned relationships',async()=>{
  await db.query('select public.ingest_career_match($1::jsonb)',[JSON.stringify(report())])
  await db.query('insert into public.buddy_relationships values($1,$2,now())',[owner,other])
  await db.query('insert into public.player_blocks values($1,$2,now())',[other,owner])
  await mark();await db.query('select public.anonymize_account_history($1)',[owner])
  const erased=await db.query<{report:unknown}>('select report from public.career_matches')
  expect(JSON.stringify(erased.rows)).not.toContain(owner);expect(JSON.stringify(erased.rows)).not.toContain('Secret Owner');expect(JSON.stringify(erased.rows)).toContain('Deleted player')
  await db.query('delete from auth.users where id=$1',[owner]) // Models the Auth Admin hard-delete transaction's FK cascade.
  await db.query('select public.ingest_career_match($1::jsonb)',[JSON.stringify(report(2))])
  const data=JSON.stringify((await db.query('select report from public.career_matches')).rows)
  expect(data).not.toContain(owner);expect(data).not.toContain('secretowner99');expect(data).toContain('Other Player')
  expect((await db.query('select * from public.buddy_relationships')).rows).toHaveLength(0)
  expect((await db.query('select * from public.player_blocks')).rows).toHaveLength(0)
  expect((await db.query('select * from public.profiles where id=$1',[owner])).rows).toHaveLength(0)
  expect((await db.query('select * from public.career_match_players where user_id=$1',[owner])).rows).toHaveLength(0)
  expect((await db.query<{metrics:{cardsDrawn:number}}>('select metrics from public.career_totals where user_id=$1',[other])).rows[0].metrics.cardsDrawn).toBe(2)
  expect((await db.query('select * from public.account_erasure_markers')).rows).toHaveLength(1)
  expect((await db.query('select public.account_erasure_ready() as ready')).rows[0].ready).toBe(true)
})
it('still rejects unregistered participants without a trusted erasure marker',async()=>{
  const input=report();input.players[0].id='user:33333333-3333-4333-8333-333333333333'
  await expect(db.query('select public.ingest_career_match($1::jsonb)',[JSON.stringify(input)])).rejects.toThrow(/Registered players/)
})
