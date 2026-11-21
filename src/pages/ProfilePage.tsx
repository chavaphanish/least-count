import { IdentityEditor } from '../auth/IdentityEditor'
import { MyProfile } from '../career/MyProfile'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'
import {
  AVATAR_MAX_BYTES,
  avatarType,
} from '../shared/multiplayer'
export function ProfilePage({ editingOnly = false }: { editingOnly?: boolean }) {
  const auth = useAuth()
  const user = auth.user!
  if (user.player.accountType !== 'registered')
    return editingOnly ? <p>Profile editing is available to registered accounts.</p> : (
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
        <a href="#/">Return to Lounge</a>
      </section>
    )
  return editingOnly ? <ProfileEditor /> : <MyProfile />
}

function ProfileEditor() {
  const auth = useAuth()
  const user = auth.user!
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processing, setProcessing] = useState(false)
  const pending = !!file
  useEffect(() => {
    if (!pending) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest('a')
      if (
        !link ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return
      const url = new URL(link.href, location.href)
      if (
        (url.hash === location.hash && url.pathname === location.pathname)
      )
        return
      if (!confirm('Discard unsaved profile changes?')) event.preventDefault()
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', navigate, true)
    }
  }, [pending])
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
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
  async function persistPhoto() {
    if (file)
      await auth.services.api('/profile/avatar', {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type },
      })
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
  return <div className="settings-profile-editor">
    <IdentityEditor photo={{
      busy: busy || processing, error, notice,
      save: persistPhoto,
      saved: () => { setFile(null); setPreview(null); setNotice(''); setError('') },
      render: (saving, edited) => <div className="profile-photo-control">
        <button type="button" className="profile-photo-trigger" aria-label="Edit profile picture" disabled={saving || busy || processing}
          onClick={() => { edited(); setNotice(''); if (fileInput.current) { fileInput.current.value = ''; fileInput.current.click() } }}>
          <Avatar player={{ ...user.player, avatarUrl: preview ?? user.player.avatarUrl }} />
          <span className="profile-photo-pencil" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z" /></svg></span>
        </button>
        <input ref={fileInput} type="file" hidden aria-label="Profile picture" accept="image/jpeg,image/png,image/webp" disabled={saving || busy || processing} onChange={event => { edited(); void choose(event.target.files?.[0]) }} />
        <small>{processing ? 'Preparing photo…' : 'JPG, PNG, WebP · max 5 MB'}</small>
        {user.player.avatarUrl && <button type="button" className="text-button profile-photo-remove" disabled={saving || busy || processing} onClick={() => { edited(); void remove() }}>Remove picture</button>}
      </div>,
    }} />
  </div>
}
