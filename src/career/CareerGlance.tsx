import { useAuth } from '../auth/AuthProvider'
import { useCareer } from './useCareer'
import { xpProgress } from './model'
import type { CareerData } from './model'
/** Reuses the existing career endpoint and level calculation; guest games stay casual. */
export function CareerGlance() {
  const { user } = useAuth(),
    registered = user?.player.accountType === 'registered'
  const { data, error } = useCareer<CareerData>(
    registered ? '/career?op=profile' : null,
  )
  if (!registered)
    return <p className="career-glance-note">Guest session · casual games</p>
  if (!data)
    return (
      <p className="career-glance-note">
        {error
          ? 'Career details are available from your profile.'
          : 'Loading your career…'}
      </p>
    )
  const xp = xpProgress(data.profile.xp, data.config.levelBase)
  return (
    <div className="career-glance" aria-label="Your career">
      <div>
        <strong>Level {xp.level}</strong>
        <span>{data.profile.xp.toLocaleString()} XP</span>
      </div>
      <progress max={xp.needed} value={xp.earned} aria-label="Level progress" />
      <small>
        Global #{data.profile.rank ?? '—'} · {data.profile.gamesWon} wins
      </small>
    </div>
  )
}
