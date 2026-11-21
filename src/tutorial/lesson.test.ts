import {expect,it} from 'vitest'
import {buildLesson} from './lesson'
import {handTotal} from '../game/deck'
it('replays legal engine transitions with conserved cards and both declaration outcomes',()=>{
  const frames=buildLesson()
  expect(buildLesson()).toEqual(frames)
  expect(frames[0].game.players.map(p=>p.hand.length)).toEqual([7,7,7])
  const deal = frames[0].game
  const cards = [...deal.players.flatMap(p=>p.hand), ...deal.drawPile, ...deal.discards.flat(), deal.indicator]
  expect(new Set(cards.map(c=>c.id)).size).toBe(53)
  expect(handTotal(deal.players[0].hand,deal.indicator.rank)).toBe(34)
  expect(new Set(frames.map(f=>f.step)).size).toBe(11)
  const seven=frames.find(f=>f.game.phase==='penalty')!
  expect(seven.game.sevens?.amount).toBe(2)
  const after=frames[frames.indexOf(seven)+1].game
  expect(after.players[1].hand.length-seven.game.players[1].hand.length).toBe(4)
  const win=frames.find(f=>f.step===9)!.game
  expect(win.result?.successful).toBe(true)
  expect(handTotal(win.players[2].hand,win.indicator.rank)).toBeGreaterThan(40)
  expect(win.result?.scores.map(s=>s.penalty)).toEqual([0,40,40])
  expect(frames.find(f=>f.step===10 && f.game.result)?.game.result?.scores.map(s=>s.penalty)).toEqual([0,0,40])
  expect(frames.at(-1)?.game.round).toBe(2)
})
