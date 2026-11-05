import { useCallback, useEffect, useRef, useState } from 'react'
import { applyAction, createGame, isPlaying } from '../game/engine'
import type { Action, GameState } from '../game/engine'
import { botView, chooseBotAction } from '../game/bot'
import { loadSession, saveSession } from '../lib/session'

function restore() {
  try {
    const saved = loadSession(window.sessionStorage)
    return saved && isPlaying(saved) && saved.deadline !== null && saved.deadline <= Date.now()
      ? applyAction(saved, { type: 'timeout' })
      : saved
  } catch {
    return null
  }
}

export function useLocalGame() {
  const [game, setGame] = useState<GameState | null>(restore)
  const ref = useRef(game)
  const [now, setNow] = useState(Date.now)
  const [error, setError] = useState('')
  const [canSave, setCanSave] = useState(true)
  const commit = useCallback((next: GameState | null) => {
    ref.current = next
    setGame(next)
    setError('')
  }, [])
  const send = useCallback(
    (action: Action) => {
      if (!ref.current) return null
      try {
        const time = Date.now()
        const next = applyAction(ref.current, action, time)
        commit(next)
        setNow(time)
        return next
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'That action could not be completed.',
        )
        return null
      }
    },
    [commit],
  )
  useEffect(() => {
    try {
      saveSession(window.sessionStorage, game)
    } catch {
      setCanSave(false)
    }
  }, [game])
  const running = Boolean(game && isPlaying(game))
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      const current = ref.current
      if (current && isPlaying(current) && current.deadline !== null && current.deadline <= time)
        send({ type: 'timeout' })
    }, 250)
    return () => window.clearInterval(timer)
  }, [running, send])
  useEffect(() => {
    if (!game || !isPlaying(game) || game.current === 0) return
    const snapshot = game
    const timer = window.setTimeout(() => {
      if (ref.current === snapshot) send(chooseBotAction(botView(snapshot)))
    }, 850)
    return () => window.clearTimeout(timer)
  }, [game, send])
  const start = (count: number) => {
    const names = [
      'You',
      'Alex',
      'Sam',
      'Robin',
      'Morgan',
      'Jamie',
      'Casey',
      'Taylor',
    ]
    commit(createGame(names.slice(0, count)))
    setNow(Date.now())
  }
  return { game, now, error, canSave, send, start, reset: () => commit(null) }
}
