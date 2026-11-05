import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'
import {
  AVATAR_MAX_BYTES,
  avatarType,
  displayName,
} from '../shared/multiplayer'
export function ProfilePage() {
  const auth = useAuth()
  const user = auth.user!
  const [name, setName] = useState(user.player.displayName)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )
  if (user.player.accountType !== 'registered')
    return (
      <section className="profile-panel">
        <h1>Guest player</h1>
        <p>Profile settings are available to registered accounts.</p>
        <a href="#/">Return to dashboard</a>
      </section>
    )
  async function choose(image: File | undefined) {
    setError('')
    setFile(null)
    setPreview(null)
    if (!image) return
    try {
      if (image.size > AVATAR_MAX_BYTES)
        throw new Error('Choose an image no larger than 2 MB.')
      avatarType(new Uint8Array(await image.arrayBuffer()), image.type)
      const bitmap = await createImageBitmap(image)
      const valid = bitmap.width <= 4096 && bitmap.height <= 4096
      bitmap.close()
      if (!valid)
        throw new Error('Choose an image no larger than 4096 × 4096 pixels.')
      setFile(image)
      setPreview(URL.createObjectURL(image))
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'This image could not be decoded.',
      )
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await auth.services.api('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: displayName(name) }),
      })
      if (file)
        await auth.services.api('/profile/avatar', {
          method: 'POST',
          body: file,
          headers: { 'Content-Type': file.type },
        })
      await auth.refresh()
      setFile(null)
      setPreview(null)
      setNotice('Your profile is saved.')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The profile could not be saved.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    setError('')
    try {
      await auth.services.api('/profile/avatar', { method: 'DELETE' })
      await auth.refresh()
      setPreview(null)
      setFile(null)
      setNotice('Profile picture removed.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="profile-panel">
      <a className="text-link" href="#/">
        ← Dashboard
      </a>
      <p className="eyebrow">YOUR SEAT AT THE TABLE</p>
      <h1>
        Player <em>profile.</em>
      </h1>
      <Avatar
        player={{ ...user.player, avatarUrl: preview ?? user.player.avatarUrl }}
      />
      <form onSubmit={save}>
        <label>
          Display name
          <input
            required
            minLength={2}
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Profile picture
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>
        <p className="field-hint">
          JPG, PNG, or WebP · up to 2 MB · up to 4096 × 4096 pixels. Profile
          pictures are visible to other players.
        </p>
        <div className="auth-actions">
          <button className="button button-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          {user.player.avatarUrl && (
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={remove}
            >
              Remove picture
            </button>
          )}
        </div>
      </form>
      <dl className="account-details">
        <dt>Email (private)</dt>
        <dd>{user.email}</dd>
        <dt>Account created</dt>
        <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
        <dt>Last activity</dt>
        <dd>{new Date(user.lastActiveAt).toLocaleString()}</dd>
        <dt>Player ID</dt>
        <dd>{user.player.id}</dd>
      </dl>
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
    </section>
  )
}
