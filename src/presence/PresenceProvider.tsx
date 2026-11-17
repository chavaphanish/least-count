import {createContext,useContext,useEffect,useMemo,useRef,useSyncExternalStore} from 'react'
import type {ReactNode} from 'react'
import {useAuth} from '../auth/AuthProvider'
import {PresenceClient,presenceId} from './client'
const Context=createContext<PresenceClient|null>(null)
export function PresenceProvider({children}:{children:ReactNode}){
  const auth=useAuth(),uid=auth.status==='ready'&&auth.user?.player.accountType==='registered'?presenceId(auth.user.player):null
  const store=useMemo(()=>new PresenceClient((ids,heartbeat,signal)=>auth.services.api('/presence',{method:'POST',body:JSON.stringify({ids,heartbeat})},signal),uid),[auth.services,uid])
  useEffect(()=>{
    const visibility=()=>store.setVisible(document.visibilityState==='visible')
    visibility();store.start();document.addEventListener('visibilitychange',visibility)
    return()=>{document.removeEventListener('visibilitychange',visibility);store.stop()}
  },[store])
  return <Context.Provider value={store}>{children}</Context.Provider>
}
const empty=()=>()=>{},offline=()=>false
export function usePresence(player:{id?:string;accountType?:string}){
  const store=useContext(Context),id=presenceId(player),ref=useRef<HTMLSpanElement>(null)
  const online=useSyncExternalStore(store?.subscribe??empty,()=>store?.isOnline(id)??false,offline)
  useEffect(()=>{if(store&&id&&ref.current)return store.watch(ref.current,id)},[store,id])
  return {ref,online}
}
