import { createGame, latestGroup } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
export function auditGame(players = 4, count = 7): GameState {
  for (let seed = 1; seed < 1000; seed++) {
    let value = seed
    const game = createGame(
      [
        'You',
        'Alex',
        'Sam',
        'Robin',
        'Morgan',
        'Jamie',
        'Casey',
        'Taylor',
      ].slice(0, players),
      Date.now(),
      () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0
        return value / 4294967296
      },
    )
    if (
      game.current !== 0 ||
      game.phase !== 'turn' ||
      latestGroup(game)[0].rank === '7'
    )
      continue
    if (count > 7)
      game.players[0].hand.push(...game.drawPile.splice(0, count - 7))
    game.events = Array.from({ length: 18 }, (_, i) => ({
      type: 'PILE_RECYCLED',
      id: `audit-${i}`,
      sequenceNumber: i + 1,
      roundNumber: 1,
      timestamp: Date.now(),
    }))
    game.eventSequence = 18
    return game
  }
  throw new Error('Audit fixture not found')
}
