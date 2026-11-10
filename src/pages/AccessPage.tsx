import { SignupForm } from '../auth/SignupForm'
import { CompactForm } from '../components/CompactForm'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { displayName } from '../shared/multiplayer'
export function AccessPage({ invitation }: { invitation: string | null }) {
  const auth = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup' | 'guest' | 'reset'>(
    'signin',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'guest') await auth.guest(displayName(name))
      else {
        const provider = auth.services.provider
        if (!provider)
          throw new Error(
            'Registered sign-in is not configured yet. Continue as a guest or play local practice.',
          )
        if (mode === 'reset') {
          const { error } = await provider.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/auth/callback?flow=recovery`,
          })
          if (error) throw error
          setNotice(
            'If an account exists for that email, a reset link has been requested. Check your inbox. Email delivery depends on the configured provider.',
          )
        } else {
          const { error } = await provider.auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw error
          await auth.refresh()
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      className="access-page"
      data-access-mode={mode}
      aria-labelledby="access-title"
    >
      <div className="access-story">
        <p className="eyebrow">GOOD FRIENDS. GREAT CARDS.</p>
        <h1 id="access-title">
          Welcome to
          <br />
          <em>your table.</em>
        </h1>
        <p>Bring a name. Bring a little strategy. We’ll bring the cards.</p>
        {invitation && (
          <p className="invitation-banner">
            Your invitation to room <strong>{invitation}</strong> will be kept
            while you sign in.
          </p>
        )}
        <a className="text-link" href="#/game">
          Play Game <span aria-hidden="true">→</span>
        </a>
        <small>
          Local practice with simulated opponents is always available.
        </small>
      </div>
      <div className="access-card">
        <div className="access-tabs" role="group" aria-label="Account access">
          {(['signin', 'signup', 'guest'] as const).map((value) => (
            <button
              key={value}
              disabled={busy}
              className={mode === value ? 'active-tab' : ''}
              onClick={() => {
                setMode(value)
                setError('')
                setNotice('')
              }}
            >
              {value === 'signin'
                ? 'Sign In'
                : value === 'signup'
                  ? 'Sign Up'
                  : 'Continue as Guest'}
            </button>
          ))}
        </div>
        <h2>
          {mode === 'guest'
            ? 'Make yourself at home.'
            : mode === 'signup'
              ? 'A new seat at the table.'
              : mode === 'reset'
                ? 'Reset your password.'
                : 'Welcome back.'}
        </h2>
        {!auth.configured && mode !== 'guest' && (
          <p className="service-note">
            Registered accounts need Supabase configuration. Guest rooms and
            local practice are available now.
          </p>
        )}
        {mode === 'signup' ? (
          auth.configured ? (
            <SignupForm
              onBusyChange={setBusy}
              email={email}
              onEmailChange={setEmail}
            />
          ) : (
            <p className="field-hint">
              Continue as Guest or play local practice while registration is
              configured.
            </p>
          )
        ) : (
          <CompactForm shortSteps onSubmit={submit}>
            {mode === 'guest' && (
              <label>
                Display name
                <input
                  required
                  minLength={2}
                  maxLength={24}
                  autoComplete="nickname"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            {mode !== 'guest' && (
              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            {mode === 'signin' && (
              <label>
                Password
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            {(error || auth.error) && (
              <p className="game-alert" role="alert">
                {error || auth.error}
              </p>
            )}
            {notice && (
              <p className="form-notice" role="status">
                {notice}
              </p>
            )}
            <button
              className="button button-primary"
              disabled={busy || (mode !== 'guest' && !auth.configured)}
            >
              {busy
                ? 'Please wait…'
                : mode === 'guest'
                  ? 'Enter as guest'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : 'Sign in'}
            </button>
          </CompactForm>
        )}
        {mode === 'signin' && (
          <button
            className="text-button"
            onClick={() => {
              setMode('reset')
              setError('')
              setNotice('')
            }}
          >
            Forgot password?
          </button>
        )}
        {mode === 'guest' && (
          <p className="account-fineprint">
            No email required. Your server-verified guest session lasts up to
            seven days. Keep this browser’s cookies to recover your seat.
          </p>
        )}
      </div>
    </section>
  )
}
