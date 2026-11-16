import { useAuth } from '../auth/AuthProvider'
import { useCareer } from '../career/useCareer'
import { xpProgress } from '../career/model'
import type { CareerData } from '../career/model'
import { Avatar } from './Avatar'
import { playerIdentity } from '../shared/playerIdentity'

/** Header identity with the existing career data and level progress calculation. */
export function HeaderProfile() {
  const { user } = useAuth()
  const player = user?.player
  const registered = player?.accountType === 'registered'
  const { data } = useCareer<CareerData>(
    registered ? '/career?op=profile' : null,
  )
  if (!player) return null
  const identity = playerIdentity(player)
  const xp = data ? xpProgress(data.profile.xp, data.config.levelBase) : null
  return (
    <a className="brand header-profile" href="#/profile" aria-label="Your profile">
      <Avatar player={player} />
      <span className="header-profile-lines">
        <strong>{identity.primary}</strong>
        <small>
          {identity.secondary || (registered ? 'Registered account' : 'Guest player')}
        </small>
      </span>
      {xp && (
        <span className="header-profile-level" aria-label={`Level ${xp.level}, ${data!.profile.xp.toLocaleString()} XP`}>
          <strong>Level {xp.level}</strong>
          <span aria-hidden="true">|</span>
          <span title={`${data!.profile.xp.toLocaleString()} total XP`}>
            {xp.earned.toLocaleString()} / {xp.needed.toLocaleString()} XP
          </span>
          <progress max={xp.needed} value={xp.earned} aria-label="Level progress" />
        </span>
      )}
    </a>
  )
}
