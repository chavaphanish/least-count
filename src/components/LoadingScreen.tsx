import { StudioLogo } from './StudioLogo'

export function LoadingScreen({
  step,
  message,
  error,
  retry,
}: {
  step: number
  message: string
  error: string
  retry: () => void
}) {
  return (
    <section className="startup-screen studio-loading" aria-labelledby="startup-title">
      <StudioLogo />
      <h1 id="startup-title" className="visually-hidden">Least Count</h1>
      {!error && <div className="loading-spinner" aria-hidden="true" />}
      <p role={error ? 'alert' : 'status'}>{error || message}</p>
      {!error && (
        <>
          <div
            className="startup-progress"
            role="progressbar"
            aria-label="Initialization checks completed"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={step}
          >
            <span style={{ width: `${(step / 4) * 100}%` }} />
          </div>
          <small>{step} of 4 initialization checks completed</small>
        </>
      )}
      {error && (
        <div className="auth-actions">
          <button className="button button-primary" onClick={retry}>
            Retry initialization
          </button>
          <a className="button button-secondary" href="#/game">
            Play offline practice
          </a>
        </div>
      )}
    </section>
  )
}
