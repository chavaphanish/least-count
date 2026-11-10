import { expect, it } from 'vitest'
import { playerIdentity, withPlayerNames } from './playerIdentity'
it('formats public names and exactly one prefixed username', () => {
  expect(playerIdentity({displayName:'old', firstName:'José 李',lastName:'O’Neill',username:'cardmaster99'})).toEqual({primary:'José 李 O’Neill',secondary:'@cardmaster99',label:'José 李 O’Neill (@cardmaster99)'})
})
it('supports missing legacy names and guest display names', () => {
  expect(playerIdentity({displayName:'old',username:'legacyuser'})).toEqual({primary:'@legacyuser',secondary:'',label:'@legacyuser'})
  expect(playerIdentity({displayName:'Guest'}).label).toBe('Guest')
  expect(playerIdentity({displayName:'old',username:'@cardmaster99',firstName:'John',lastName:''}).label).toBe('John (@cardmaster99)')
})

it('decorates result/event names on a copy while retaining guest labels and game state', () => {
  const state = {players:[{id:'p0',name:'You'},{id:'p1',name:'Guest'}],events:[{player:{id:'p0',name:'You'}}]}
  const output = withPlayerNames(state,[{id:'p0',displayName:'old',username:'cardmaster99',firstName:'John',lastName:'Smith'}])
  expect(output.players[0].name).toBe('John Smith (@cardmaster99)')
  expect(output.events[0].player.name).toBe('John Smith (@cardmaster99)')
  expect(output.players[1].name).toBe('Guest')
  expect(state.players[0].name).toBe('You')
})
