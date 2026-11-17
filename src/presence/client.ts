const INTERVAL=30_000,TTL=60_000
export function presenceId(player:{id?:string;accountType?:string}) {
  if(player.accountType==='guest')return null
  const id=player.id?.replace(/^user:/,'')??''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)?id:null
}
type ReadPresence=(ids:string[],heartbeat:boolean,signal:AbortSignal)=>Promise<{online:Record<string,number>}>
/** One scheduler and one in-flight batch for the entire app, never one timer per avatar. */
export class PresenceClient {
  private revision=0
  getSnapshot=()=>this.revision
  track(ids:string[]){
    const unique=[...new Set(ids)]
    unique.forEach(id=>this.add(id))
    return()=>unique.forEach(id=>this.remove(id))
  }
  private listeners=new Set<()=>void>()
  private refs=new Map<string,number>()
  private online=new Map<string,number>()
  private timer:ReturnType<typeof setTimeout>|undefined
  private controller=new AbortController()
  private observer:IntersectionObserver|undefined
  private elements=new Map<Element,{id:string;visible:boolean}>()
  private started=false
  private visible=true
  private nextBeat=0
  private queued=false
  private busy=false
  private dirty=false
  constructor(private read:ReadPresence,private uid:string|null,private now=()=>performance.now()){}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
  isOnline=(id:string|null)=>!!id&&(this.online.get(id)??0)>this.now()
  private emit(){this.revision++;for(const listener of this.listeners)listener()}
  start(){if(this.controller.signal.aborted)this.controller=new AbortController();this.started=true;this.flush()}
  stop(){this.started=false;clearTimeout(this.timer);this.controller.abort();this.observer?.disconnect();this.elements.clear()}
  setVisible(visible:boolean){if(this.visible===visible)return;this.visible=visible;if(visible){this.nextBeat=0;this.flush()}this.schedule()}
  watch(element:Element,id:string){
    const item={id,visible:false};this.elements.set(element,item)
    if(typeof IntersectionObserver==='undefined'){item.visible=true;this.add(id)}
    else {
      this.observer??=new IntersectionObserver(entries=>{
        for(const entry of entries){const value=this.elements.get(entry.target);if(!value||value.visible===entry.isIntersecting)continue;value.visible=entry.isIntersecting;if(value.visible)this.add(value.id);else this.remove(value.id)}
      },{rootMargin:'40px'})
      this.observer.observe(element)
    }
    return()=>{this.observer?.unobserve(element);this.elements.delete(element);if(item.visible)this.remove(id)}
  }
  private add(id:string){this.refs.set(id,(this.refs.get(id)??0)+1);if(this.refs.get(id)===1&&id!==this.uid)this.flush()}
  private remove(id:string){const n=(this.refs.get(id)??1)-1;if(n)this.refs.set(id,n);else{this.refs.delete(id);if(id!==this.uid)this.online.delete(id)}this.schedule()}
  private flush(){
    if(!this.started||!this.visible||this.queued)return
    this.queued=true;queueMicrotask(()=>{this.queued=false;void this.refresh()})
  }
  private async refresh(){
    if(!this.started||!this.visible)return
    if(this.busy){this.dirty=true;return}
    this.busy=true
    const heartbeat=!!this.uid&&this.now()>=this.nextBeat
    if(this.now()>=this.nextBeat)this.nextBeat=this.now()+INTERVAL
    const ids=[...new Set([...(this.uid?[this.uid]:[]),...this.refs.keys()])]
    try {
      for(let index=0;index<ids.length;index+=100){
        const batch=ids.slice(index,index+100),sent=this.now()
        const result=await this.read(batch,heartbeat&&index===0,this.controller.signal)
        if(!this.started)return
        if(!result?.online||typeof result.online!=='object')throw new Error('Presence unavailable')
        for(const id of batch){const remaining=result.online[id],ttl=typeof remaining==='number'&&Number.isFinite(remaining)?Math.min(TTL,remaining)-(this.now()-sent):0;if(ttl>0)this.online.set(id,this.now()+ttl);else this.online.delete(id)}
      }
      this.emit()
    }catch{/* Existing indicators expire naturally; failed networking never blocks the app. */}
    finally{this.busy=false;if(this.started){this.schedule();if(this.dirty){this.dirty=false;this.flush()}}}
  }
  private schedule(){
    clearTimeout(this.timer);if(!this.started)return
    const now=this.now();let changed=false
    for(const[id,until]of this.online)if(until<=now){this.online.delete(id);changed=true}
    if(changed)this.emit()
    const due=Math.min(this.visible&&!this.busy&&(this.uid||this.refs.size)?this.nextBeat:Infinity,...this.online.values())
    if(Number.isFinite(due))this.timer=setTimeout(()=>{this.schedule();if(this.visible&&this.now()>=this.nextBeat)this.flush()},Math.max(1,due-now))
  }
}
