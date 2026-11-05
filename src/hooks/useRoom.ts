import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type {
  ClientGameAction,
  RoomView,
  SocketMessage,
} from '../shared/multiplayer'
export function useRoom(code: string) {
  const auth = useAuth()
  const [room, setRoom] = useState<RoomView | null>(null)
  const [connection, setConnection] = useState<
    'connecting' | 'live' | 'reconnecting' | 'error'
  >('connecting')
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [retry, setRetry] = useState(0)
  const socket = useRef<WebSocket | null>(null)
  const pending = useRef<string | null>(null)
  const ackTimer = useRef<number | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let stopped = false
    let reconnect: number | undefined
    let heartbeat: number | undefined
    let attempt = 0
    async function connect() {
      if (stopped) return
      setConnection(attempt ? 'reconnecting' : 'connecting')
      try {
        const snapshot = await auth.services.api<RoomView>(
          `/rooms/${code}/join`,
          { method: 'POST' },
        )
        if (stopped) return
        setRoom(snapshot)
        const { ticket } = await auth.services.api<{ ticket: string }>(
          `/rooms/${code}/ticket`,
          { method: 'POST' },
        )
        if (stopped) return
        const url = new URL(`/api/rooms/${code}/ws`, location.origin)
        url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        url.searchParams.set('ticket', ticket)
        const ws = new WebSocket(url)
        socket.current = ws
        ws.onopen = () => {
          if (stopped) {
            ws.close()
            return
          }
          attempt = 0
          setConnection('live')
          setError('')
          heartbeat = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: 'ping' }))
          }, 20_000)
        }
        ws.onmessage = (event) => {
          if (stopped) return
          try {
            const message = JSON.parse(event.data) as SocketMessage
            if (message.type === 'state') {
              setRoom(message.room)
              setOffset(message.room.serverNow - Date.now())
              if (message.room.status === 'closed') {
                setConnection('error')
                setError('This room is closed.')
              }
            }
            if (
              message.type === 'ack' &&
              pending.current === message.requestId
            ) {
              pending.current = null
              window.clearTimeout(ackTimer.current)
              setBusy(false)
            }
            if (message.type === 'error') {
              setError(message.message)
              pending.current = null
              window.clearTimeout(ackTimer.current)
              setBusy(false)
            }
            if (message.type === 'pong')
              setOffset(message.serverNow - Date.now())
          } catch {
            setError(
              'The server sent an invalid update. Reconnect to restore the table.',
            )
          }
        }
        ws.onclose = (event) => {
          if (heartbeat) window.clearInterval(heartbeat)
          if (stopped) return
          pending.current = null
          window.clearTimeout(ackTimer.current)
          setBusy(false)
          if (event.code === 4001) {
            setConnection('error')
            setError(event.reason || 'The room has closed.')
            return
          }
          setConnection('reconnecting')
          setError(
            'Connection interrupted. Your seat is reserved while reconnecting.',
          )
          reconnect = window.setTimeout(
            () => {
              attempt++
              void connect()
            },
            Math.min(1000 * 2 ** attempt, 10_000),
          )
        }
        ws.onerror = () => ws.close()
      } catch (error) {
        if (stopped) return
        setConnection('error')
        setError(
          error instanceof Error
            ? error.message
            : 'The room could not be reached.',
        )
      }
    }
    void connect()
    const clock = window.setInterval(() => setNow(Date.now()), 500)
    return () => {
      stopped = true
      if (reconnect) window.clearTimeout(reconnect)
      if (heartbeat) window.clearInterval(heartbeat)
      window.clearTimeout(ackTimer.current)
      pending.current = null
      window.clearInterval(clock)
      socket.current?.close()
      socket.current = null
    }
  }, [code, auth.user?.player.id, auth.services, retry])
  const send = useCallback((action: ClientGameAction) => {
    const ws = socket.current
    if (!ws || ws.readyState !== WebSocket.OPEN || pending.current) return false
    const requestId = crypto.randomUUID()
    pending.current = requestId
    setBusy(true)
    setError('')
    ws.send(JSON.stringify({ type: 'action', requestId, action }))
    ackTimer.current = window.setTimeout(() => {
      if (pending.current === requestId) {
        pending.current = null
        window.clearTimeout(ackTimer.current)
        setBusy(false)
        setError(
          'The action was not acknowledged. Reconnect to check the current state before retrying.',
        )
      }
    }, 10_000)
    return true
  }, [])
  async function command(action: 'start' | 'leave' | 'close') {
    setError('')
    setBusy(true)
    try {
      await auth.services.api(`/rooms/${code}/${action}`, { method: 'POST' })
      if (action !== 'start') {
        await auth.refresh()
        location.hash = '#/'
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return {
    room,
    connection,
    error,
    busy,
    now: now + offset,
    send,
    command,
    reconnect: () => setRetry((value) => value + 1),
  }
}
