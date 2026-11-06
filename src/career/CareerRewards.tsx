import { useEffect, useState } from 'react'
import { useCareer } from './useCareer'
import { xpProgress } from './model'
export function CareerRewards({
  game,
  round,
}: {
  game: string
  round: number
}) {
  const [attempts, setAttempts] = useState(0)
  const { data, error, refresh } = useCareer<{
    awards: { type: string; amount: number; before: number; after: number }[]
    config: { levelBase: number }
  }>(`/career?op=reward&game=${game}&round=${round}`)
  useEffect(() => {
    if (data?.awards.length || attempts >= 12) return
    const timer = setInterval(() => {
      refresh()
      setAttempts((n) => n + 1)
    }, 5000)
    return () => clearInterval(timer)
  }, [data?.awards.length, refresh, attempts])
  if (!data?.awards.length)
    return (
      <p className="field-hint" role="status">
        {attempts >= 12
          ? 'Rewards are not available yet. Check your profile later.'
          : error
            ? 'Career rewards could not be loaded. You can retry from your profile.'
            : 'Career results are syncing. Rewards appear after server confirmation.'}
      </p>
    )
  const before = Math.min(...data.awards.map((a) => a.before)),
    after = Math.max(...data.awards.map((a) => a.after))
  const previousLevel = xpProgress(before, data.config.levelBase).level,
    level = xpProgress(after, data.config.levelBase).level
  return (
    <aside className="career-reward" aria-label="XP rewards" role="status">
      <p>
        {data.awards
          .map(
            (a) =>
              `${a.type === 'round' ? 'Round completed' : a.type === 'game' ? 'Game completed' : 'Victory Bonus'}! +${a.amount} XP`,
          )
          .join(' · ')}
      </p>
      {level > previousLevel && <p>Level Up! You reached Level {level}.</p>}
      <a className="text-link" href="#/profile">
        View career →
      </a>
    </aside>
  )
}
