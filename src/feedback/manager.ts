import { AudioPlayer } from './audio'
import type { Sound } from './audio'
import type { TurnMotion } from '../components/TurnAnimation'
import { FeedbackTracker } from './tracker'
import type { Cursor } from './tracker'
export type Preferences={sound:boolean;vibration:boolean;turnNotifications:boolean}
export const PREFERENCES_KEY='least-count:feedback:v1'
export const defaults:Preferences={sound:true,vibration:true,turnNotifications:true}
export function loadPreferences(storage:Pick<Storage,'getItem'>|null):Preferences {
  try { const saved=JSON.parse(storage?.getItem(PREFERENCES_KEY)??'null');return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof saved?.[key]==='boolean'?saved[key]:value])) as Preferences } catch { return {...defaults} }
}
export class FeedbackManager {
  preferences:Preferences
  private listeners=new Set<()=>void>()
  private tickKey:string|null=null
  private motionStages=new WeakMap<TurnMotion,Set<string>>()
  private lastCard=-Infinity
  private vibrationKind=''
  readonly tracker:FeedbackTracker
  constructor(readonly audio=new AudioPlayer(), private mobile=()=>false, private storage:Storage|null=null, private session:Storage|null=null) {
    this.preferences=loadPreferences(storage)
    this.tracker=new FeedbackTracker(this,key=>{
      try {const c=JSON.parse(this.session?.getItem(`lc:feedback:${key}`)??'null') as Cursor|null;return c&&Number.isSafeInteger(c.sequence)&&Number.isFinite(c.timestamp)&&typeof c.turn==='string'?c:null} catch{return null}
    },(key,c)=>{try{this.session?.setItem(`lc:feedback:${key}`,JSON.stringify(c))}catch{/* Private/storage-disabled mode remains playable. */}})
  }
  reload(){
    const old=this.preferences;this.preferences=loadPreferences(this.storage)
    if(!this.preferences.sound)this.audio.stopAll()
    else if(!old.sound&&this.tickKey)this.audio.play('timer_tick','tick',2,true)
    if(!this.preferences.vibration)this.cancelVibration()
    if(!this.preferences.turnNotifications){this.audio.stop('turn');if(this.vibrationKind==='turn')this.cancelVibration()}
    for(const listener of this.listeners)listener()
  }
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
  snapshot=()=>this.preferences
  unlock(){void this.audio.unlock().then(()=>{if(this.tickKey&&this.preferences.sound&&!document.hidden)this.audio.play('timer_tick','tick',2,true)})}
  supported=()=>this.mobile()&&typeof navigator.vibrate==='function'
  set(key:keyof Preferences,value:boolean) {
    this.preferences={...this.preferences,[key]:value}
    try{this.storage?.setItem(PREFERENCES_KEY,JSON.stringify(this.preferences))}catch{/* Optional persistence. */}
    if(!this.preferences.sound)this.audio.stopAll()
    else if(key==='sound'&&this.tickKey)this.audio.play('timer_tick','tick',2,true)
    if(!this.preferences.vibration)this.cancelVibration()
    if(!this.preferences.turnNotifications){this.audio.stop('turn');if(this.vibrationKind==='turn')this.cancelVibration()}
    for(const listener of this.listeners)listener()
  }
  private vibrate(pattern:number|number[],kind:string) {
    if(!this.preferences.vibration||!this.supported()||document.hidden)return
    try{navigator.vibrate(pattern);this.vibrationKind=kind}catch{/* Unsupported/blocked hardware. */}
  }
  private cancelVibration(){try{if(this.supported())navigator.vibrate(0)}catch{/* Unsupported. */}this.vibrationKind=''}
  sound(name:Sound,key:string) {
    if(!this.preferences.sound||document.hidden)return
    const now=performance.now()
    if(name.startsWith('card_')&&now-this.lastCard<75)return
    if(name.startsWith('card_'))this.lastCard=now
    this.audio.play(name,key,1)
  }
  turn(_key:string) {
    if(!this.preferences.turnNotifications||document.hidden)return
    if(this.preferences.sound){this.audio.stop('turn');this.audio.play('turn_bell','turn',3)}
    this.vibrate(150,'turn')
  }
  celebrate(game:boolean,key:string) {
    this.stop()
    if(this.preferences.sound)this.audio.play(game?'game_applause':'round_applause',key,game?5:4)
    this.vibrate(game?[150,120,150,120,150]:[150,120,150],'celebration')
  }
  tick(key:string|null) {
    if(key===this.tickKey)return
    this.audio.stop('tick');this.tickKey=key
    if(key&&this.preferences.sound)this.audio.play('timer_tick','tick',2,true)
  }
  motion(motion:TurnMotion,stage:string) {
    let stages=this.motionStages.get(motion)
    if(!stages){stages=new Set();this.motionStages.set(motion,stages)}
    if(stages.has(stage))return
    stages.add(stage)
    this.sound(stage==='outgoing'?'card_drop':motion.incoming?.faceDown?'card_draw':'card_pickup',`motion:${performance.now()}:${stage}`)
  }
  endTurn(){this.tick(null);this.audio.stop('turn');if(this.vibrationKind==='turn')this.cancelVibration()}
  stop(){this.audio.stopAll();this.tickKey=null;this.cancelVibration()}
}
