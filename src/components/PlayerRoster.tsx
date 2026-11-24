import { Avatar } from './Avatar'
import { TableOverlay } from './TableOverlay'
import { playerFirstName } from '../shared/playerIdentity'
import type { PlayerIdentityData } from '../shared/playerIdentity'

type Seat = PlayerIdentityData & {
  id: string
  cardCount: number
  score: number
  eliminated: boolean
  forfeited?: boolean
  status: string
}

export function PlayerRoster({ players, viewer, active }: {
  players: Seat[]
  viewer: string
  active?: string
}) {
  const first = Math.max(0, players.findIndex(player => player.id === viewer))
  return <div className="table-roster" role="group" aria-label="Players in turn order">
    {[...players.slice(first), ...players.slice(0, first)].map(player => {
      const name = playerFirstName(player)
      const state = player.eliminated ? 'Eliminated' : player.forfeited ? 'Forfeited' : ''
      return <TableOverlay key={player.id} label={`${name} details`}
        triggerClass={`roster-seat${active === player.id ? ' active-seat' : ''}`}
        trigger={<>
          <Avatar player={player}/>
          <strong>{name}{state && <small> · {state}</small>}</strong>
          <span>{player.cardCount} Cards | {player.score} pts</span>
        </>}>
        <div className="opponent-detail"><Avatar player={player}/><h3>{name}</h3>
          <p>{player.cardCount} cards · {player.score} cumulative points</p>
          <p>{state || (active === player.id ? 'Taking a turn' : player.status)}</p>
        </div>
      </TableOverlay>
    })}
  </div>
}
