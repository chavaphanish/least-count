import { useRef, useState } from 'react'
import { useAuth } from './AuthProvider'
import { useUsername } from './useUsername'
import { CompactForm } from '../components/CompactForm'
import { identityFields } from '../components/IdentityFields'
import { PasswordField } from '../components/PasswordField'
import {
  passwordError,
  personalName,
  registrationEmail,
  username,
  validEmail,
} from '../shared/identity'
export function SignupForm({
  onBusyChange,
  email,
  onEmailChange,
}: {
  onBusyChange: (value: boolean) => void
  email: string
  onEmailChange: (value: string) => void
}) {
  const auth = useAuth()
  const setEmail = onEmailChange
  const [step, setStep] = useState(0),
    [identity, setIdentity] = useState({
      username: '',
      firstName: '',
      lastName: '',
    }),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const submitting = useRef(false),
    availability = useUsername(identity.username)
  const firstValid = (() => {
    try {
      personalName(identity.firstName)
      personalName(identity.lastName)
      return availability.available
    } catch {
      return false
    }
  })()
  const passwordIssue = password ? passwordError(password) : '',
    mismatch =
      confirmation && confirmation !== password ? 'Passwords do not match.' : ''
  const ready =
    firstValid &&
    validEmail(email) &&
    !passwordError(password) &&
    confirmation === password
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current || notice) return
    if (step < 2) {
      if (step === 0 ? firstValid : validEmail(email)) {
        setStep(step + 1)
        setError('')
      }
      return
    }
    if (!ready) return
    submitting.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    setNotice('')
    try {
      const available = await auth.services.api<{ available: boolean }>(
        `/username?username=${username(identity.username)}`,
      )
      if (!available.available) {
        availability.refresh()
        setStep(0)
        setError('Username already taken. Choose another username.')
        return
      }
      const provider = auth.services.provider
      if (!provider)
        throw new Error(
          'Registration is not configured yet. You can still continue as a guest.',
        )
      const { data, error } = await provider.auth.signUp({
        email: registrationEmail(email),
        password,
        options: {
          data: {
            username: username(identity.username),
            first_name: personalName(identity.firstName),
            last_name: personalName(identity.lastName),
          },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      if (data.session) await auth.refresh()
      else
        setNotice(
          'Check your email for the verification link before signing in. If you already have an account, use Sign In or reset your password.',
        )
    } catch (reason) {
      let message =
        reason instanceof Error
          ? reason.message
          : 'Registration could not complete. Please retry.'
      if (/already.*registered|already.*exists|email.*in use/i.test(message))
        message =
          'If you already have an account, use Sign In or reset your password.'
      try {
        const current = await auth.services.api<{ available: boolean }>(
          `/username?username=${username(identity.username)}`,
        )
        if (!current.available) {
          availability.refresh()
          message = 'Username already taken. Choose another username.'
          setStep(0)
        }
      } catch {
        /* Keep the original provider/setup error. */
      }
      setError(message)
    } finally {
      submitting.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  return (
    <div
      className="signup-wizard"
      data-signup-step={step + 1}
      aria-label="Three-step sign up"
    >
      <div className="signup-step">
        <button
          className="text-button"
          type="button"
          disabled={busy || step === 0}
          onClick={() => {
            setStep(step - 1)
            setError('')
          }}
        >
          Back
        </button>
        <span aria-live="polite">
          Step {step + 1} of 3 ·{' '}
          {['Player Identity', 'Email Address', 'Password'][step]}
        </span>
      </div>
      <CompactForm key={step} className="signup-form" onSubmit={submit}>
        {step === 0 &&
          identityFields({
            values: identity,
            onChange: (field, value) =>
              setIdentity((v) => ({ ...v, [field]: value })),
            message: `${availability.message} Your name and @username are public.`,
          })}
        {step === 1 && (
          <>
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!email && !validEmail(email)}
              />
            </label>
            {email && !validEmail(email) && (
              <p className="identity-feedback field-hint" role="status">
                Enter a valid email address.
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <PasswordField
              data-form-field
              label="Password"
              value={password}
              onChange={setPassword}
              error={passwordIssue}
            />
            <PasswordField
              data-form-field
              label="Confirm Password"
              value={confirmation}
              onChange={setConfirmation}
              error={mismatch}
            />
          </>
        )}
        {error && (
          <p className="game-alert signup-message" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="form-notice signup-message" role="status">
            {notice}
          </p>
        )}
        <button
          className="button button-primary"
          disabled={
            busy ||
            !!notice ||
            !auth.configured ||
            (step === 0
              ? !firstValid
              : step === 1
                ? !validEmail(email)
                : !ready)
          }
        >
          {busy ? 'Creating account…' : step === 2 ? 'Create account' : 'Next'}
        </button>
      </CompactForm>
    </div>
  )
}
