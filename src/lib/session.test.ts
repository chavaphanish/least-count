import { describe, expect, it } from 'vitest'
import { applyAction, createGame } from '../game/engine'
import { botView, chooseBotAction } from '../game/bot'
import { isSavedGame, loadSession, saveSession, SESSION_KEY } from './session'
import type { SessionStore } from './session'

function memoryStore(): SessionStore {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}
describe('local session', () => {
  it('round-trips the game without renewing its deadline', () => {
    const store = memoryStore()
    const game = createGame(['You', 'Alex'], 1000)
    saveSession(store, game)
    expect(loadSession(store)).toEqual(game)
    expect(loadSession(store)!.deadline).toBe(61_000)
    saveSession(store, null)
    expect(loadSession(store)).toBeNull()
  })
  it.each(['not JSON', '{}', '{"version":99}'])(
    'discards malformed or outdated saves: %s',
    (raw) => {
      const store = memoryStore()
      store.setItem(SESSION_KEY, raw)
      expect(loadSession(store)).toBeNull()
      expect(store.getItem(SESSION_KEY)).toBeNull()
    },
  )
  it('rejects malformed nested hands, duplicate identities, and invalid turn indices', () => {
    const game = createGame(['You', 'Alex'])
    expect(isSavedGame({ ...game, current: 9 })).toBe(false)
    expect(
      isSavedGame({
        ...game,
        players: [{ ...game.players[0], hand: [null] }, game.players[1]],
      }),
    ).toBe(false)
    expect(
      isSavedGame({
        ...game,
        drawPile: [game.players[0].hand[0], ...game.drawPile],
      }),
    ).toBe(false)
  })
  it('can restore every intermediate phase of a complete simulated match', () => {
    const store = memoryStore()
    let seed = 42
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    let game = createGame(['You', 'Alex', 'Sam', 'Robin'], 0, random)
    let steps = 0
    while (game.phase !== 'game-over' && steps < 5000) {
      saveSession(store, game)
      expect(loadSession(store)).toEqual(game)
      game = applyAction(
        game,
        game.phase === 'round-over'
          ? { type: 'next-round' }
          : chooseBotAction(botView(game)),
        ++steps * 100,
        random,
      )
    }
    expect(game.phase).toBe('game-over')
    saveSession(store, game)
    expect(loadSession(store)).toEqual(game)
  })
})
