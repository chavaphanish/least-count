import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type { Relationship } from './model'
export function BuddyAction({
  id,
  relationship = 'none',
  onChange,
  blocking = false,
}: {
  id: string
  relationship?: Relationship
  onChange: () => void
  blocking?: boolean
}) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function act(action: string) {
    setBusy(true)
    setError('')
    try {
      await auth.services.api('/career', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      })
      onChange()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please retry.')
    } finally {
      setBusy(false)
    }
  }
  if (auth.user?.player.accountType !== 'registered')
    return (
      <a className="text-link" href="#/profile">
        Register to add buddies
      </a>
    )
  if (`user:${id}` === auth.user.player.id) return null
  return (
    <div className="buddy-actions">
      {relationship === 'none' && (
        <button
          className="button button-secondary compact-button"
          disabled={busy}
          onClick={() => void act('request')}
        >
          Add Buddy
        </button>
      )}
      {relationship === 'incoming' && (
        <>
          <button
            className="button button-primary compact-button"
            disabled={busy}
            onClick={() => void act('accept')}
          >
            Accept
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void act('decline')}
          >
            Decline
          </button>
        </>
      )}
      {relationship === 'outgoing' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void act('cancel')}
        >
          Cancel request
        </button>
      )}
      {relationship === 'accepted' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void act('remove')}
        >
          Remove Buddy
        </button>
      )}
      {blocking && relationship !== 'blocked' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void act('block')}
        >
          Block player
        </button>
      )}
      {relationship === 'blocked' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void act('unblock')}
        >
          Unblock
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
