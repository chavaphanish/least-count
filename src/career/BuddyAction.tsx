import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type { Relationship } from './model'
export function BuddyAction({
  id,
  relationship = 'none',
  onChange,
  blocking = false,
  circle = false,
  onSuccess,
}: {
  id: string
  relationship?: Relationship
  onChange: () => void
  blocking?: boolean
  circle?: boolean
  onSuccess?: (message: string) => void
}) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState(relationship)
  useEffect(() => setCurrent(relationship), [relationship])
  const status = circle ? current : relationship
  async function act(action: string) {
    setBusy(true)
    setError('')
    try {
      const result = await auth.services.api<{ relationship: Relationship }>('/career', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      })
      setCurrent(result.relationship)
      onSuccess?.(action === 'request' ? 'Friend request sent.' : action === 'accept' ? 'Friend request accepted.' : action === 'decline' ? 'Friend request declined.' : 'Friendship updated.')
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
      {status === 'none' && (
        <button
          className="button button-secondary compact-button"
          disabled={busy}
          onClick={() => void act('request')}
        >
          {circle ? 'Add Friend' : 'Add Buddy'}
        </button>
      )}
      {status === 'incoming' && (
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
      {circle && (status === 'outgoing' || status === 'accepted') && (
        <button className="button button-secondary compact-button" disabled>
          {status === 'outgoing' ? 'Request Sent' : 'Friends'}
        </button>
      )}
      {!circle && status === 'outgoing' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void act('cancel')}
        >
          Cancel request
        </button>
      )}
      {!circle && status === 'accepted' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void act('remove')}
        >
          Remove Buddy
        </button>
      )}
      {blocking && status !== 'blocked' && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void act('block')}
        >
          Block player
        </button>
      )}
      {status === 'blocked' && (
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
