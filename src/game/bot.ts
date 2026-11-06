import { cardValue, handTotal } from './deck'
import type { GameCard, GameRank } from './deck'
import type { Rank } from './cards'
import type { Action, GameState, Phase } from './engine'
import { latestGroup, pickupCards, canShow } from './engine'

export type BotView = {
  playerId: string
  hand: GameCard[]
  selectedRank: Rank
  topRank?: GameRank
  pickup: GameCard[]
  phase: Phase
  canShow?: boolean
}

/** The strategy receives no draw order or opponent hands. */
export function botView(state: GameState): BotView {
  const player = state.players[state.current]
  return {
    playerId: player.id,
    hand: player.hand,
    selectedRank: state.indicator.rank,
    topRank: latestGroup(state).at(-1)?.rank,
    pickup: pickupCards(state),
    phase: state.phase,
    canShow: canShow(state, player.id),
  }
}

export function chooseBotAction(view: BotView): Action {
  const { playerId, hand, selectedRank, phase } = view
  if (phase === 'draw') {
    const best = [...view.pickup].sort(
      (a, b) => cardValue(a, selectedRank) - cardValue(b, selectedRank),
    )[0]
    return best && cardValue(best, selectedRank) <= 4
      ? { type: 'draw', playerId, source: 'discard', cardId: best.id }
      : { type: 'draw', playerId, source: 'pile' }
  }
  if (phase === 'penalty') {
    const sevens = hand.filter((c) => c.rank === '7')
    return sevens.length
      ? { type: 'discard', playerId, cardIds: sevens.map((c) => c.id) }
      : { type: 'accept-penalty', playerId }
  }
  if (phase !== 'turn') throw new Error('The bot cannot act between rounds.')
  if (view.canShow !== false && handTotal(hand, selectedRank) <= 5)
    return { type: 'show', playerId }
  const groups = new Map<GameRank, GameCard[]>()
  for (const card of hand)
    groups.set(card.rank, [...(groups.get(card.rank) ?? []), card])
  const weight = (cards: GameCard[]) =>
    handTotal(cards, selectedRank) +
    cards.length * 3 +
    (cards[0].rank === view.topRank ? 6 : 0)
  const best = [...groups.values()].sort((a, b) => weight(b) - weight(a))[0]
  return { type: 'discard', playerId, cardIds: best.map((c) => c.id) }
}
