import { afterEach, expect, it, vi } from 'vitest'
import { careerApi } from './career-api'
import { requireAuth, publicConfig } from './auth'
import type { Env } from './types'
import { circleGames, searchCircle } from './circle'
vi.mock('./circle', () => ({circleGames:vi.fn(),searchCircle:vi.fn()}))
vi.mock('./auth', () => ({requireAuth:vi.fn(),publicConfig:vi.fn()}))
afterEach(()=>vi.resetAllMocks())
const id = '11111111-1111-4111-8111-111111111111'
const env = {CAREER_ENABLED:'true',SUPABASE_CAREER_KEY:'server-only',CAREER_ORIGIN:'https://game.test'} as Env
async function setup(missing = false) {
  const rpc = vi.fn(async (name: string) => name === 'career_api' ? {data:{profile:{id,username:'cardmaster99',displayName:'old'},players:[{id:`user:${id}`,name:'historical',stats:{}}],rounds:[{scores:[{id:`user:${id}`,name:'historical'}]}]},error:null} : missing ? {error:{code:'PGRST202'},data:null} : {data:[{id,username:'cardmaster99',first_name:'John',last_name:'Smith'}],error:null})
  vi.mocked(requireAuth).mockResolvedValue({client:{rpc},uid:id} as never)
  vi.mocked(publicConfig).mockReturnValue({supabase:{url:'https://test.supabase.co',publishableKey:'public'}})
  const response = await careerApi(new Request('https://game.test/api/career'), env)
  return {data:await response.json() as any,rpc}
}
it('hydrates current profiles and historical identities by stable ID using public fields only', async () => {
  const {data,rpc}=await setup()
  expect(data.profile).toMatchObject({displayName:'John Smith',firstName:'John',lastName:'Smith',username:'cardmaster99'})
  expect(data.players[0].name).toBe('John Smith (@cardmaster99)')
  expect(data.rounds[0].scores[0].username).toBe('cardmaster99')
  expect(JSON.stringify(data)).not.toMatch(/server-only|email|token|first_name/)
  expect(rpc).toHaveBeenLastCalledWith('public_player_identities',{player_ids:[id]})
})
it('keeps usernames and historical labels usable before the migration is applied',async()=>{
  const {data}=await setup(true)
  expect(data.profile.displayName).toBe('@cardmaster99')
  expect(data.players[0].name).toBe('historical')
})

it('routes circle username searches through the authenticated public projection and identity hydration',async()=>{
  const rpc=vi.fn(async()=>({data:[{id,username:'cardmaster99',first_name:'John',last_name:'Smith'}],error:null}))
  vi.mocked(requireAuth).mockResolvedValue({client:{rpc},uid:id} as never)
  vi.mocked(publicConfig).mockReturnValue({supabase:{url:'https://test.supabase.co',publishableKey:'public'}})
  vi.mocked(searchCircle).mockResolvedValue([{id,username:'cardmaster99',xp:123,relationship:'incoming'}])
  const response=await careerApi(new Request('https://game.test/api/career?op=search&scope=circle&query=MaStEr'),env)
  expect(searchCircle).toHaveBeenCalledWith(expect.objectContaining({rpc}),env,'https://test.supabase.co',id,'MaStEr')
  expect(await response.json()).toMatchObject([{username:'cardmaster99',firstName:'John',lastName:'Smith',relationship:'incoming',xp:123}])
  expect(rpc).not.toHaveBeenCalledWith('career_api',expect.anything())
})
it('only enriches the requested circle friend list with owner-scoped shared-game counts',async()=>{
  const players=[{id,username:'cardmaster99',relationship:'accepted'}]
  const rpc=vi.fn(async(name:string)=>name==='career_api'?{data:{players,blocked:[]},error:null}:{data:[],error:null})
  vi.mocked(requireAuth).mockResolvedValue({client:{rpc},uid:id} as never)
  vi.mocked(publicConfig).mockReturnValue({supabase:{url:'https://test.supabase.co',publishableKey:'public'}})
  vi.mocked(circleGames).mockResolvedValue([{...players[0],gamesTogether:25}])
  const response=await careerApi(new Request('https://game.test/api/career?op=buddies&scope=circle'),env)
  expect(circleGames).toHaveBeenCalledWith(env,'https://test.supabase.co',id,players)
  expect(await response.json()).toMatchObject({players:[{gamesTogether:25}]})
})
