import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { FeedbackManager } from './manager'
import type { FeedbackSnapshot } from './tracker'
function storage(name:'localStorage'|'sessionStorage') { try{return window[name]}catch{return null} }
const Context=createContext<FeedbackManager|null>(null)
export function FeedbackProvider({children}:{children:ReactNode}) {
  const [manager]=useState(()=>new FeedbackManager(undefined,()=>!!document.querySelector('[data-mobile-device]'),storage('localStorage'),storage('sessionStorage')))
  useEffect(()=>{
    manager.audio.preload()
    const unlock=(event:Event)=>{if(event.isTrusted&&!document.hidden)manager.unlock()}
    const suspend=()=>{if(document.hidden)manager.tracker.suspend()}
    const leave=()=>manager.tracker.suspend()
    const sync=(event:StorageEvent)=>{if(event.key==='least-count:feedback:v1')manager.reload()}
    document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true)
    document.addEventListener('visibilitychange',suspend);window.addEventListener('pagehide',leave);window.addEventListener('storage',sync)
    return()=>{document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',suspend);window.removeEventListener('pagehide',leave);window.removeEventListener('storage',sync);manager.stop();manager.audio.dispose()}
  },[manager])
  return <Context.Provider value={manager}>{children}</Context.Provider>
}
export function useFeedback(){const value=useContext(Context);if(!value)throw new Error('FeedbackProvider is missing');return value}
export function useFeedbackPreferences(){const manager=useFeedback();return useSyncExternalStore(manager.subscribe,manager.snapshot,manager.snapshot)}
export function useGameFeedback(snapshot:FeedbackSnapshot|null){
  const manager=useFeedback(),latest=useRef(snapshot);latest.current=snapshot
  const scope=snapshot?.scope
  useEffect(()=>{if(snapshot)manager.tracker.update(snapshot,!document.hidden);else manager.stop()},[manager,snapshot])
  useEffect(()=>{
    const visible=()=>{if(!document.hidden&&latest.current)manager.tracker.update(latest.current,true)}
    document.addEventListener('visibilitychange',visible)
    return()=>{document.removeEventListener('visibilitychange',visible);if(scope)manager.tracker.detach(scope)}
  },[manager,scope])
}
