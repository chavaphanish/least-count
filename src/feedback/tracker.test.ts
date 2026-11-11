import { describe,it,expect,vi } from 'vitest'
import { FeedbackTracker } from './tracker'
import type { FeedbackSnapshot,FeedbackSink,Cursor } from './tracker'
import type { GameEvent } from '../game/events'
const event=(sequenceNumber:number,type:string='TURN_COMPLETED',extra:object={})=>({id:`event-${sequenceNumber}`,sequenceNumber,roundNumber:1,timestamp:10000,type,...extra}) as GameEvent
function setup(){const sink:FeedbackSink={sound:vi.fn(),turn:vi.fn(),celebrate:vi.fn(),tick:vi.fn(),stop:vi.fn(),endTurn:vi.fn()};const saved=new Map<string,Cursor>();const tracker=new FeedbackTracker(sink,k=>saved.get(k)??null,(k,v)=>saved.set(k,v));return{sink,tracker,saved}}
const base=(extra:Partial<FeedbackSnapshot>={}):FeedbackSnapshot=>({scope:'room:test',round:1,phase:'turn',localId:'you',currentId:'other',players:[{id:'you',eliminated:false},{id:'other',eliminated:false}],events:[event(1,'ROUND_STARTED',{timestamp:0})],deadline:60000,now:10000,connected:true,reducedMotion:false,...extra})
describe('confirmed feedback tracking',()=>{
 it('notifies only a new local turn, not repeated snapshots, replacement phases or opponents',()=>{
  const {tracker,sink}=setup();tracker.update(base())
  const turn=base({currentId:'you',events:[event(1,'ROUND_STARTED',{timestamp:0}),event(2,'TURN_COMPLETED',{player:{id:'other'},cards:[],draw:'none'})]})
  tracker.update(turn);tracker.update(turn);tracker.update({...turn,phase:'draw',now:11000});expect(sink.turn).toHaveBeenCalledTimes(1)
  tracker.update({...turn,currentId:'other',events:[...turn.events,event(3,'TURN_COMPLETED',{player:{id:'you'},cards:[],draw:'none'})]});expect(sink.turn).toHaveBeenCalledTimes(1)
 })
 it('supports untimed turns, including returning to the same player after a complete cycle',()=>{
  const {tracker,sink}=setup();tracker.update(base({deadline:null,currentId:'you'}))
  tracker.update(base({deadline:null,currentId:'you',events:[event(2,'POWER_SEVEN_CYCLE_COMPLETED')]}));expect(sink.turn).toHaveBeenCalledTimes(1)
 })
 it('never notifies eliminated players or spectators',()=>{
  for(const players of [[{id:'you',eliminated:true}],[]]){
   const {tracker,sink}=setup();tracker.update(base({players}));tracker.update(base({players,currentId:'you',events:[event(2,'POWER_SEVEN_CYCLE_COMPLETED')]}));expect(sink.turn).not.toHaveBeenCalled()
  }
 })
 it('starts ticking once on the authoritative 15-second crossing and stops on expiry/turn change',()=>{
  const {tracker,sink}=setup();tracker.update(base({currentId:'you',deadline:30000,now:14000}))
  tracker.update(base({currentId:'you',deadline:30000,now:15000}));tracker.update(base({currentId:'you',deadline:30000,now:16000}))
  expect(vi.mocked(sink.tick).mock.calls.filter(([key])=>key!==null)).toHaveLength(1)
  tracker.update(base({currentId:'you',deadline:30000,now:30000}));expect(sink.tick).toHaveBeenLastCalledWith(null)
  tracker.update(base({deadline:null}));expect(sink.tick).toHaveBeenLastCalledWith(null)
 })
 it('final rounds produce only the game celebration once, stopping ticking first',()=>{
  const {tracker,sink}=setup();tracker.update(base())
  const done=base({phase:'game-over',events:[event(2,'ROUND_COMPLETED'),event(3,'GAME_COMPLETED')]})
  tracker.update(done);tracker.update(done);expect(sink.celebrate).toHaveBeenCalledExactlyOnceWith(true,expect.any(String));expect(sink.tick).toHaveBeenLastCalledWith(null)
 })
 it('round applause is once per confirmed result, including a player eliminated this round',()=>{
  const {tracker,sink}=setup();tracker.update(base());const done=base({phase:'round-over',players:[{id:'you',eliminated:true}],events:[event(2,'ROUND_COMPLETED')]})
  tracker.update(done);tracker.update(done);expect(sink.celebrate).toHaveBeenCalledExactlyOnceWith(false,expect.any(String))
 })
 it('does not replay after reconnect, visibility suspension, remount or persisted refresh',()=>{
  const {tracker,sink,saved}=setup();tracker.update(base());tracker.update(base({connected:false}))
  const turn=base({currentId:'you',events:[event(2,'POWER_SEVEN_CYCLE_COMPLETED')]})
  tracker.update(turn);expect(sink.turn).not.toHaveBeenCalled()
  tracker.suspend();tracker.update({...turn,events:[event(3,'POWER_SEVEN_CYCLE_COMPLETED')]},false);tracker.update({...turn,events:[event(3,'POWER_SEVEN_CYCLE_COMPLETED')]})
  tracker.detach(turn.scope);tracker.update(turn);const reopened=new FeedbackTracker(sink,k=>saved.get(k)??null);reopened.update(turn);expect(sink.turn).not.toHaveBeenCalled()
 })
 it('ignores regressing and late events instead of replaying old turns or celebrations',()=>{
  const {tracker,sink}=setup();tracker.update(base({events:[event(8,'ROUND_STARTED',{timestamp:0})]}))
  tracker.update(base({currentId:'you',events:[event(2,'GAME_COMPLETED')]}));tracker.update(base({currentId:'you',now:50000,events:[event(9,'POWER_SEVEN_CYCLE_COMPLETED')]}));expect(sink.turn).not.toHaveBeenCalled();expect(sink.celebrate).not.toHaveBeenCalled()
 })
 it('plays one deal for a newly confirmed round and none when restoring old history',()=>{
  const {tracker,sink}=setup();tracker.update(base({currentId:'you',events:[event(1,'ROUND_STARTED')]}));expect(sink.sound).toHaveBeenCalledWith('card_deal',expect.any(String));expect(sink.turn).toHaveBeenCalledTimes(1)
  tracker.update(base({currentId:'you',events:[event(1,'ROUND_STARTED')]}));expect(sink.turn).toHaveBeenCalledTimes(1)
 })
})

it('stops obsolete local turn alerts when eliminated or the authoritative deadline changes',()=>{
 const {tracker,sink}=setup();tracker.update(base({currentId:'you'}));tracker.update(base({currentId:'you',players:[{id:'you',eliminated:true}],events:[event(2,'PLAYER_ELIMINATED',{player:{id:'you'},reason:'timeout',cutoff:100})]}));expect(sink.endTurn).toHaveBeenCalledTimes(1)
})
it('confirmed opponent partial drops sound once without inventing a completed turn',()=>{
 const {tracker,sink}=setup();tracker.update(base({dropIds:'opening'}));tracker.update(base({dropIds:'drop-1'}));tracker.update(base({dropIds:'drop-1'}));expect(sink.sound).toHaveBeenCalledExactlyOnceWith('card_drop',expect.any(String));expect(sink.turn).not.toHaveBeenCalled()
})

it('older room revisions cannot replay a partial drop even when no turn event has been emitted',()=>{
 const {tracker,sink}=setup();tracker.update(base({revision:4,dropIds:'new'}));tracker.update(base({revision:3,dropIds:'old'}));expect(sink.sound).not.toHaveBeenCalled()
})
