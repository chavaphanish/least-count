export const sounds = ['card_deal','card_draw','card_pickup','card_drop','card_swoosh','turn_bell','timer_tick','round_applause','game_applause'] as const
export type Sound = typeof sounds[number]
const volume: Record<Sound,number> = {card_deal:.22,card_draw:.24,card_pickup:.24,card_drop:.25,card_swoosh:.16,turn_bell:.22,timer_tick:.17,round_applause:.28,game_applause:.28}

/** One context, decoded buffers and bounded sources. No autoplay or background queue. */
export class AudioPlayer {
  private context: AudioContext | null = null
  private bytes = new Map<Sound,Promise<ArrayBuffer | null>>()
  private buffers = new Map<Sound,Promise<AudioBuffer | null>>()
  private active = new Map<string,{source?: AudioBufferSourceNode; gain?: GainNode; priority:number;name:Sound}>()
  preload() {
    for (const name of sounds) if (!this.bytes.has(name)) this.bytes.set(name,fetch(`/audio/${name}.mp3`).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null))
  }
  async unlock() {
    try {
      const Constructor = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
      if (!Constructor) return
      this.context ??= new Constructor()
      const resumed=this.context.resume().catch(()=>{})
      this.preload()
      for (const name of sounds) if (!this.buffers.has(name)) {
        const context=this.context
        this.buffers.set(name,this.bytes.get(name)!.then(data=>data?context.decodeAudioData(data.slice(0)):null).catch(()=>null))
      }
      await resumed
      await Promise.all(this.buffers.values())
    } catch { /* Audio support/permissions must never affect the game. */ }
  }
  play(name: Sound, key: string, priority: number, loop=false) {
    const context=this.context
    if (!context || context.state!=='running' || document.hidden || this.active.has(key)) return
    if (Array.from(this.active.values()).some(v=>v.priority>priority && !(name==='card_deal'&&v.priority===3))) return
    this.stopBelow(priority)
    const entry={priority,name} as {source?:AudioBufferSourceNode;gain?:GainNode;priority:number;name:Sound}
    const bufferPromise=this.buffers.get(name)
    if(!bufferPromise)return
    const started=performance.now()
    this.active.set(key,entry)
    void bufferPromise.then(buffer=>{
      if (!buffer || this.active.get(key)!==entry || document.hidden || context.state!=='running' || performance.now()-started>200) { if(this.active.get(key)===entry)this.active.delete(key); return }
      try {
        const source=context.createBufferSource(), gain=context.createGain()
        source.buffer=buffer;source.loop=loop;gain.gain.value=volume[name]
        source.connect(gain);gain.connect(context.destination)
        entry.source=source;entry.gain=gain
        source.onended=()=>{source.disconnect();gain.disconnect();if(this.active.get(key)===entry)this.active.delete(key)}
        source.start()
      } catch { this.active.delete(key) }
    })
  }
  stop(key: string) {
    const entry=this.active.get(key);this.active.delete(key)
    try { entry?.source?.stop();entry?.source?.disconnect();entry?.gain?.disconnect() } catch { /* Already ended. */ }
  }
  stopBelow(priority: number) { for(const [key,value] of this.active) if(value.priority<priority && !(priority===3&&value.name==='card_deal'))this.stop(key) }
  stopAll() { for(const key of this.active.keys())this.stop(key) }
  dispose() { this.stopAll();void this.context?.close().catch(()=>{});this.context=null;this.buffers.clear() }
}
