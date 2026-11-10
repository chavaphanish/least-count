import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { useUsername } from './useUsername'
import { CompactForm } from '../components/CompactForm'
import { identityFields } from '../components/IdentityFields'
import { personalName, username } from '../shared/identity'
export function IdentityEditor() {
  const auth = useAuth(),
    profile = auth.user!.profile!
  const [values, setValues] = useState({
    username: profile.username,
    firstName: profile.firstName,
    lastName: profile.lastName,
  })
  const availability = useUsername(values.username)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  let valid = availability.available
  try {
    personalName(values.firstName)
    personalName(values.lastName)
  } catch {
    valid = false
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !valid) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await auth.services.api('/profile/identity', {
        method: 'PATCH',
        body: JSON.stringify({
          username: username(values.username),
          firstName: personalName(values.firstName),
          lastName: personalName(values.lastName),
        }),
      })
      await auth.refresh()
      setNotice('Your identity is saved. Personal names stay private.')
    } catch (reason) {
      availability.refresh()
      setError(reason instanceof Error ? reason.message : 'Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section id="profile-editor" className="career-section identity-editor">
      <h2>
        {profile.needsCompletion ? 'Complete your profile' : 'Player Identity'}
      </h2>
      <CompactForm onSubmit={save}>
        {identityFields({
          values,
          onChange: (field, value) => {
            setValues((v) => ({ ...v, [field]: value }))
            setNotice('')
          },
          message: notice || error ? '' : availability.message,
        })}
        {error && (
          <p className="game-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}
        <button className="button button-primary" disabled={busy || !valid}>
          {busy ? 'Saving…' : 'Save identity'}
        </button>
      </CompactForm>
      {!notice && !error && (
        <p className="field-hint">
          Only your @username is public. First and last names are private.
        </p>
      )}
    </section>
  )
}
