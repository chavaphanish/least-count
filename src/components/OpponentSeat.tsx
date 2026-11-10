import type { ReactNode } from 'react'
import { playerIdentity } from '../shared/playerIdentity'
import { PlayerIdentity } from './PlayerIdentity'
import type { PlayerIdentityData } from '../shared/playerIdentity'
import { Avatar } from './Avatar'
import { PlayingCard } from './PlayingCard'
import { useMobileLandscape } from './MobileOrientation'
import { TableOverlay } from './TableOverlay'

export function OpponentSeat({player, count, score, active, eliminated, status, timer}: {
  player:PlayerIdentityData; count:number; score:number; active:boolean;
  eliminated:boolean; status:string; timer?:ReactNode
}) {
  const mobile = useMobileLandscape()
  const className = `live-opponent ${active?'active-seat':''} ${eliminated?'eliminated-seat':''}`
  if (mobile) return <TableOverlay label={`${playerIdentity(player).label} details`} triggerClass={className} trigger={<>
    <Avatar player={player}/><PlayerIdentity player={player} compact /><span>{eliminated?'Out':`${count} cards`}</span>
  </>}><div className="opponent-detail"><Avatar player={player}/><h3><PlayerIdentity player={player} /></h3><p>{count} cards · {score} cumulative points</p><p>{eliminated?'Eliminated':active?'Taking a turn':status}</p><p>Opponents’ cards stay private.</p></div></TableOverlay>
  return <div className={className}><Avatar player={player}/><PlayerIdentity player={player} compact />{timer}<span>{eliminated?'Eliminated':`${count} cards`} · {score} pts</span><small>{status}</small>{!eliminated && <div className="opponent-cards" aria-hidden="true">{Array.from({length:Math.min(3,count)},(_,i)=><PlayingCard faceDown key={i}/>)}</div>}</div>
}
