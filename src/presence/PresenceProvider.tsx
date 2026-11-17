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

const initialSnapshot=()=>0
/** Track the full friend set, including offline players absent from the Online tab. */
export function useFriendsPresence(players: {id?:string;accountType?:string}[]) {
  const store=useContext(Context)
  const key=[...new Set(players.map(presenceId).filter((id): id is string=>!!id))].sort().join(',')
  useSyncExternalStore(store?.subscribe??empty,store?.getSnapshot??initialSnapshot,initialSnapshot)
  useEffect(()=>{if(store&&key)return store.track(key.split(','))},[store,key])
  return new Set(key.split(',').filter(id=>store?.isOnline(id)))
}
