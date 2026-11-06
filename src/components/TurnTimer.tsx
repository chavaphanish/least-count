export function TurnTimer({ seconds, name }: { seconds: number | null; name: string }) {
  if (seconds === null) return null
  return (
    <div className={`turn-clock ${seconds <= 5 ? 'clock-urgent' : seconds <= 15 ? 'clock-warning' : ''}`} role="timer" aria-label={`${name}'s turn: ${seconds} seconds remaining`}>
      <span>Time left</span><strong>{seconds}s</strong>
    </div>
  )
}
