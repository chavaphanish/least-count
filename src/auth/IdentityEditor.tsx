import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { useUsername } from './useUsername'
import { CompactForm } from '../components/CompactForm'
import { identityFields } from '../components/IdentityFields'
import { personalName, username } from '../shared/identity'

type PhotoEditor = {
  render: (busy: boolean, edited: () => void) => ReactNode
  busy: boolean
  error: string
  notice: string
  save: () => Promise<void>
  saved: () => void
}
export function IdentityEditor({ photo }: { photo?: PhotoEditor }) {
  const auth = useAuth(), profile = auth.user!.profile ?? {
    username: auth.user!.player.username ?? '', firstName: auth.user!.player.firstName ?? '',
    lastName: auth.user!.player.lastName ?? '', needsCompletion: true,
  }
  const [values, setValues] = useState({ username: profile.username, firstName: profile.firstName, lastName: profile.lastName })
  const availability = useUsername(values.username)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  let valid = availability.available
  try { personalName(values.firstName); personalName(values.lastName) } catch { valid = false }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy || photo?.busy || !valid) return
    setBusy(true); setError(''); setNotice('')
    let identitySaved = false
    try {
      await auth.services.api('/profile/identity', { method: 'PATCH', body: JSON.stringify({
        username: username(values.username), firstName: personalName(values.firstName), lastName: personalName(values.lastName),
      }) })
      identitySaved = true
      await photo?.save()
      await auth.refresh()
      photo?.saved()
      setNotice(photo ? 'Your profile is saved.' : 'Your public name and username are saved.')
    } catch (reason) {
      if (photo && identitySaved) await auth.refresh().catch(() => {})
      availability.refresh()
      setError(`${photo && identitySaved ? 'Some changes were saved. Please retry. ' : ''}${reason instanceof Error ? reason.message : 'Please retry.'}`)
    } finally { setBusy(false) }
  }
  const messageError = error || photo?.error, messageNotice = photo?.notice || notice
  const Form = photo ? 'form' : CompactForm
  return <section id="profile-editor" className={`career-section identity-editor ${photo ? 'compact-profile-editor' : ''}`}>
    <h2>{profile.needsCompletion ? 'Complete your profile' : 'Player Identity'}</h2>
    {photo?.render(busy, () => { setNotice(''); setError('') })}
    <Form onSubmit={save}>
      {identityFields({ values, disabled: busy || photo?.busy, onChange: (field, value) => { setValues(v => ({ ...v, [field]: value })); setNotice('') }, message: messageNotice || messageError ? '' : availability.message })}
      {messageError && <p className="game-alert" role="alert">{messageError}</p>}
      {messageNotice && <p className="form-notice" role="status">{messageNotice}</p>}
      <button className="button button-primary" disabled={busy || photo?.busy || !valid}>
        {busy ? 'Saving…' : photo ? 'Save Changes' : 'Save identity'}
      </button>
    </Form>
    {!photo && !notice && !error && <p className="field-hint">Your name and @username are visible to other players.</p>}
  </section>
}
