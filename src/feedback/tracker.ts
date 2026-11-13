import type { GameEvent } from '../game/events'
import type { Sound } from './audio'
export type FeedbackSnapshot = {
  scope:string; round:number; phase:string; localId:string; currentId:string
  players:{id:string;eliminated:boolean;forfeited?:boolean}[]; events:GameEvent[]
  deadline:number|null; revision?:number; dropIds?:string; now:number; connected:boolean; reducedMotion:boolean
}
export interface FeedbackSink {
  sound(name:Sound,key:string):void
  turn(key:string):void
  celebrate(game:boolean,key:string):void
  tick(key:string|null):void
  stop():void
  endTurn():void
}
type Cursor={sequence:number;timestamp:number;turn:string;round:number;participant:boolean}
type Entry=Cursor & {baseline:boolean;seconds:number|null;connected:boolean;active:boolean;revision?:number;dropIds?:string}
const boundaries=new Set(['ROUND_STARTED','TURN_COMPLETED','POWER_SEVEN_PLAYED','POWER_SEVEN_PENALTY_DRAWN','POWER_SEVEN_CYCLE_COMPLETED','PLAYER_ELIMINATED','PLAYER_FORFEITED'])

/** Pure confirmed-state observer. It never dispatches game actions or owns a turn timer. */
export class FeedbackTracker {
  private entries=new Map<string,Entry>()
  constructor(private sink:FeedbackSink, private read:(key:string)=>Cursor|null=()=>null, private write:(key:string,cursor:Cursor)=>void=()=>{}) {}
  suspend(){for(const entry of this.entries.values())entry.baseline=true;this.sink.stop()}
  detach(scope:string) { const entry=this.entries.get(scope);if(entry)entry.baseline=true;this.sink.stop() }
  update(s:FeedbackSnapshot, visible=true) {
    const sequence=Math.max(0,...s.events.map(e=>e.sequenceNumber))
    const timestamp=Math.max(0,...s.events.map(e=>e.timestamp))
    const seconds=s.deadline===null?null:Math.max(0,Math.ceil((s.deadline-s.now)/1000))
    const member=s.players.find(p=>p.id===s.localId)
    const active=!!member&&!member.eliminated&&!member.forfeited&&s.currentId===s.localId&&['turn','draw','penalty'].includes(s.phase)&&s.connected
    const boundary=s.events.filter(e=>boundaries.has(e.type)).at(-1)?.sequenceNumber??0
    const turn=`${s.round}:${s.currentId}:${s.deadline??'untimed'}:${boundary}`
    let previous=this.entries.get(s.scope)
    if(s.revision!==undefined&&previous?.revision!==undefined&&s.revision<previous.revision)return
    const saved=previous??this.read(s.scope)
    const reset=!!saved&&sequence<=saved.sequence&&s.events.some(e=>e.type==='ROUND_STARTED'&&e.roundNumber===1&&e.timestamp>saved.timestamp)
    if(reset){previous=undefined;this.entries.delete(s.scope);this.sink.stop()}
    if(saved&&!reset&&sequence<saved.sequence)return
    const baseline=!previous||previous.baseline||!previous.connected
    const cursor=reset?null:saved
    const fresh=(event:GameEvent)=>event.timestamp>s.now-2500&&event.timestamp<=s.now+2000
    const initialRound=!cursor&&s.connected&&s.events.some(e=>e.type==='ROUND_STARTED'&&e.roundNumber===s.round&&fresh(e))
    const changed=s.events.filter(e=>e.sequenceNumber>(cursor?.sequence??sequence)&&fresh(e))
    const participant=previous?.round===s.round?previous.participant:!!member&&!member.eliminated
    const next:Entry={sequence:Math.max(sequence,reset?0:cursor?.sequence??0),timestamp:Math.max(timestamp,reset?0:cursor?.timestamp??0),turn,round:s.round,participant,baseline:false,seconds,connected:s.connected,active,revision:s.revision,dropIds:s.dropIds}
    this.entries.set(s.scope,next)
    if(!cursor||cursor.sequence!==next.sequence||cursor.turn!==next.turn||cursor.round!==next.round)this.write(s.scope,next)
    if(this.entries.size>12)this.entries.delete(this.entries.keys().next().value!)
    const key=`${s.scope}:${timestamp}:${sequence}`
    if(!visible||!s.connected){next.baseline=true;this.sink.stop();return}
    if(baseline&&!initialRound){this.sink.tick(null);return}
    if(previous?.active&&(!active||previous.turn!==turn))this.sink.endTurn()
    const gameEnd=changed.some(e=>e.type==='GAME_COMPLETED')
    const roundEnd=changed.some(e=>e.type==='ROUND_COMPLETED')
    if(gameEnd||roundEnd){
      this.sink.tick(null)
      if(member&&(gameEnd||participant))this.sink.celebrate(gameEnd,key)
      return
    }
    if(!active||seconds===null||seconds>15||seconds<=0||previous?.turn!==turn)this.sink.tick(null)
    const started=initialRound||changed.some(e=>e.type==='ROUND_STARTED')
    if(started){this.sink.stop();this.sink.sound('card_deal',`${key}:deal`)}
    if(s.dropIds&&previous?.dropIds!==s.dropIds&&s.currentId!==s.localId&&!changed.some(e=>e.type==='TURN_COMPLETED'||e.type==='POWER_SEVEN_PLAYED'))this.sink.sound('card_drop',`${key}:drop:${s.dropIds}`)
    // Own card flights provide their exact stage timing. Reduced-motion users
    // receive a short confirmed-event cue instead, never an intent/click sound.
    for(const event of changed) {
      if(event.type==='POWER_SEVEN_PENALTY_DRAWN')this.sink.sound('card_draw',`${key}:penalty`)
      else if(event.type==='POWER_SEVEN_PLAYED'&&event.player.id!==s.localId)this.sink.sound('card_drop',`${key}:seven`)
      else if(event.type==='TURN_COMPLETED'&&event.player.id!==s.localId)this.sink.sound(event.draw==='pickup'?'card_pickup':event.draw==='none'?'card_drop':'card_draw',`${key}:card`)
    }
    if(active&&(initialRound||(!baseline&&previous?.turn!==turn&&changed.some(e=>boundaries.has(e.type)))))this.sink.turn(`${s.scope}:${turn}`)
    if(active&&seconds!==null&&seconds>0&&seconds<=15&&previous?.turn===turn&&previous.seconds!==null&&previous.seconds>15)this.sink.tick(`${s.scope}:${turn}`)
  }
}
export type { Cursor }
