import { ScreenPages } from '../components/ScreenPages'
import { useMobileLandscape } from '../components/MobileOrientation'
import { CompactForm } from '../components/CompactForm'
import { CareerProfile } from '../career/CareerProfile'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'
import {
  AVATAR_MAX_BYTES,
  avatarType,
  displayName,
} from '../shared/multiplayer'
export function ProfilePage() {
  const mobile = useMobileLandscape()
  const [section, setSection] = useState(0)
  const auth = useAuth()
  const user = auth.user!
  const [name, setName] = useState(user.player.displayName)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processing, setProcessing] = useState(false)
  const pending = !!file || name !== user.player.displayName
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
        <button
          className="button button-secondary"
          onClick={() =>
            void auth.signOut().then(() => {
              location.hash = '#/'
            })
          }
        >
          Leave guest session to register
        </button>
        <a href="#/">Return to dashboard</a>
      </section>
    )
  async function choose(image: File | undefined) {
    setError('')
    setFile(null)
    setPreview(null)
    if (!image) return
    setProcessing(true)
    try {
      if (image.size > AVATAR_MAX_BYTES)
        throw new Error('Choose an image no larger than 5 MB.')
      avatarType(new Uint8Array(await image.arrayBuffer()), image.type)
      // Decode, center-crop, and compress phone photos before sending them.
      const bitmap = await createImageBitmap(image)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 512
      const context = canvas.getContext('2d')
      if (!context) {
        bitmap.close()
        throw new Error('Image processing is unavailable in this browser.')
      }
      const edge = Math.min(bitmap.width, bitmap.height)
      context.drawImage(
        bitmap,
        (bitmap.width - edge) / 2,
        (bitmap.height - edge) / 2,
        edge,
        edge,
        0,
        0,
        512,
        512,
      )
      bitmap.close()
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error('Could not resize this photo.')),
          'image/webp',
          0.85,
        ),
      )
      const optimized = new File([blob], 'avatar.webp', { type: blob.type })
      setFile(optimized)
      setPreview(URL.createObjectURL(optimized))
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'This image could not be decoded.',
      )
    } finally {
      setProcessing(false)
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
      <ScreenPages
        label="Profile views"
        value={section}
        onChange={setSection}
        pages={[
          {
            label: 'Career',
            content: (
              <CareerProfile
                onEdit={mobile ? () => setSection(1) : undefined}
              />
            ),
          },
          {
            label: 'Settings',
            content: (
              <div
                id="profile-editor"
                className="career-section profile-editor"
              >
                <h2>Edit Profile</h2>
                <Avatar
                  player={{
                    ...user.player,
                    avatarUrl: preview ?? user.player.avatarUrl,
                  }}
                />
                <p className="field-hint">
                  {processing
                    ? 'Preparing your preview…'
                    : pending
                      ? 'Unsaved changes'
                      : 'All changes saved'}
                </p>
                <CompactForm onSubmit={save}>
                  <label>
                    Display name
                    <input
                      id="profile-name"
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
                      disabled={busy || processing}
                      onChange={(e) => void choose(e.target.files?.[0])}
                    />
                  </label>
                  <p className="field-hint">
                    JPG, PNG, or WebP · up to 5 MB. Photos are center-cropped
                    and optimized to 512 × 512. Profile pictures are visible to
                    other players.
                  </p>
                  <div className="auth-actions">
                    <button
                      className="button button-primary"
                      disabled={busy || processing || !pending}
                    >
                      {busy
                        ? 'Uploading / saving…'
                        : processing
                          ? 'Preparing photo…'
                          : error && pending
                            ? 'Retry save'
                            : 'Save profile'}
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
                </CompactForm>
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
              </div>
            ),
          },
          {
            label: 'Account',
            content: (
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
            ),
          },
        ]}
      />
    </section>
  )
}
