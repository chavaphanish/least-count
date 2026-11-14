import type { ReactNode } from 'react'
import { gameplayIdentity, playerFirstName } from '../shared/playerIdentity'
import { PlayerIdentity } from './PlayerIdentity'
import type { PlayerIdentityData } from '../shared/playerIdentity'
import { Avatar } from './Avatar'
import { PlayingCard } from './PlayingCard'
import { useMobileLandscape } from './MobileOrientation'
import { TableOverlay } from './TableOverlay'

export function OpponentSeat({player, count, score, active, eliminated, forfeited = false, status, timer}: {
  player:PlayerIdentityData; count:number; score:number; active:boolean;
  eliminated:boolean; forfeited?:boolean; status:string; timer?:ReactNode
}) {
  const mobile = useMobileLandscape()
  const className = `live-opponent ${active?'active-seat':''} ${eliminated?'eliminated-seat':''} ${forfeited?'forfeited-seat':''}`
  if (mobile) return <TableOverlay label={`${playerFirstName(player)} details`} triggerClass={className} trigger={<>
    <Avatar player={player}/><PlayerIdentity player={gameplayIdentity(player)} compact /><span>{forfeited?'Forfeited':eliminated?'Out':`${count} cards`}</span>
  </>}><div className="opponent-detail"><Avatar player={player}/><h3><PlayerIdentity player={gameplayIdentity(player)} /></h3><p>{count} cards · {score} cumulative points</p><p>{forfeited ? (eliminated ? 'Forfeited · Eliminated (score)' : 'Forfeited this round') : eliminated?'Eliminated':active?'Taking a turn':status}</p><p>Opponents’ cards stay private.</p></div></TableOverlay>
  return <div className={className}><Avatar player={player}/><PlayerIdentity player={gameplayIdentity(player)} compact />{timer}<span>{forfeited?'Forfeited':eliminated?'Eliminated':`${count} cards`} · {score} pts</span><small>{forfeited && eliminated ? 'Eliminated (score)' : status}</small>{!eliminated && !forfeited && <div className="opponent-cards" aria-hidden="true">{Array.from({length:Math.min(3,count)},(_,i)=><PlayingCard faceDown key={i}/>)}</div>}</div>
}
