import { CompactForm } from '../components/CompactForm'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
export function RecoveryPage() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      if (!auth.services.provider)
        throw new Error('Authentication is not configured.')
      const { error } = await auth.services.provider.auth.updateUser({
        password,
      })
      if (error) throw error
      history.replaceState({}, '', '/#/')
      location.reload()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Password reset failed.',
      )
      setBusy(false)
    }
  }
  return (
    <section className="profile-panel">
      <h1>Choose a new password.</h1>
      <p>Use the reset link from your email to access this form.</p>
      <CompactForm onSubmit={submit}>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="button button-primary" disabled={busy || !auth.user}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </CompactForm>
      {error && (
        <p role="alert" className="game-alert">
          {error}
        </p>
      )}
      <a href="#/" className="text-link">
        Back to Lounge
      </a>
    </section>
  )
}
