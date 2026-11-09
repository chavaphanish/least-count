import type { ReactNode } from 'react'
import type { PublicPlayer } from '../shared/multiplayer'
import { Avatar } from './Avatar'
import { PlayingCard } from './PlayingCard'
import { useMobileLandscape } from './MobileOrientation'
import { TableOverlay } from './TableOverlay'

export function OpponentSeat({player, count, score, active, eliminated, status, timer}: {
  player:Pick<PublicPlayer,'displayName'|'avatarUrl'>; count:number; score:number; active:boolean;
  eliminated:boolean; status:string; timer?:ReactNode
}) {
  const mobile = useMobileLandscape()
  const className = `live-opponent ${active?'active-seat':''} ${eliminated?'eliminated-seat':''}`
  if (mobile) return <TableOverlay label={`${player.displayName} details`} triggerClass={className} trigger={<>
    <Avatar player={player}/><strong title={player.displayName}>{player.displayName}</strong><span>{eliminated?'Out':`${count} cards`}</span>
  </>}><div className="opponent-detail"><Avatar player={player}/><h3>{player.displayName}</h3><p>{count} cards · {score} cumulative points</p><p>{eliminated?'Eliminated':active?'Taking a turn':status}</p><p>Opponents’ cards stay private.</p></div></TableOverlay>
  return <div className={className}><Avatar player={player}/><strong>{player.displayName}</strong>{timer}<span>{eliminated?'Eliminated':`${count} cards`} · {score} pts</span><small>{status}</small>{!eliminated && <div className="opponent-cards" aria-hidden="true">{Array.from({length:Math.min(3,count)},(_,i)=><PlayingCard faceDown key={i}/>)}</div>}</div>
}
