import { cardValue } from '../src/game/deck'
import { gameEvents } from '../src/game/events'
import { isPlaying } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import type { GameReport, Metrics } from '../src/career/model'
import type { RoomRecord } from './room'
import type { Env } from './types'
import { createClient } from '@supabase/supabase-js'

export type CareerState = GameReport & {
  revision: number
  syncedRevision: number
  seq: number
  cursor: number
  turnStartedAt: number
  eligible: boolean
  activeRound: string[]
}
const add = (s: Metrics, key: string, n = 1) => {
  s[key] = (s[key] ?? 0) + n
}
const minimum = (s: Metrics, key: string, n: number) => {
  s[key] = s[key] === undefined ? n : Math.min(s[key], n)
}

export function beginCareer(r: RoomRecord, enabled: boolean, now: number) {
  if (!r.game) return
  r.career = {
    id: r.id,
    startedAt: now,
    completedAt: null,
    status: 'active',
    settings: {
      eliminationThreshold: r.settings.eliminationThreshold,
      timedGame: r.settings.timedGame,
    },
    rounds: [],
    players: r.game.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: 0,
      rank: null,
      outcome: 'active',
      stats: { gamesStarted: 1 },
    })),
    revision: 0,
    syncedRevision: -1,
    seq: 0,
    cursor: now,
    turnStartedAt: now,
    eligible:
      enabled &&
      r.members.length >= 2 &&
      r.members.every(
        (m) =>
          m.accountType === 'registered' && /^user:[0-9a-f-]{36}$/i.test(m.id),
      ),
    activeRound: [],
  }
  observeCareer(r, null, r.game, now, false)
}

/** Observe accepted state only. No private cards enter the stored report or API. */
export function observeCareer(
  r: RoomRecord,
  before: GameState | null,
  next: GameState,
  now: number,
  manual: boolean,
) {
  const c = r.career
  if (!c || !c.eligible || c.completedAt) return
  const fresh = gameEvents(next).filter((e) => e.sequenceNumber > c.seq)
  if (before && isPlaying(before)) {
    for (const p of before.players.filter((p) => !p.eliminated && !p.forfeited)) {
      const m = r.members.find((m) => m.id === p.id)
      const stats = c.players.find((v) => v.id === p.id)!.stats
      if (
        m &&
        (!m.left ||
          c.players.find((v) => v.id === p.id)!.outcome !== 'abandoned')
      )
        add(
          stats,
          'playingMs',
          Math.max(0, Math.min(now, m.lastSeen + 45_000) - c.cursor),
        )
    }
  }
  for (const m of r.members) {
    const p = c.players.find((p) => p.id === m.id)
    if (
      p &&
      m.left &&
      !next.players.find((v) => v.id === m.id)?.eliminated &&
      p.outcome === 'active'
    ) {
      p.outcome = 'abandoned'
      p.abandonedAt = now
      add(p.stats, 'gamesAbandoned')
    }
  }
  for (const event of fresh) {
    const stats =
      'player' in event
        ? c.players.find((p) => p.id === event.player.id)?.stats
        : undefined
    if (event.type === 'ROUND_STARTED') {
      c.activeRound = next.players
        .filter(
          (p) =>
            !p.eliminated &&
            c.players.find((v) => v.id === p.id)?.outcome !== 'abandoned',
        )
        .map((p) => p.id)
      c.activeRound.forEach((id) =>
        add(c.players.find((p) => p.id === id)!.stats, 'roundsPlayed'),
      )
    }
    if (
      event.type === 'TURN_COMPLETED' ||
      event.type === 'POWER_SEVEN_PLAYED'
    ) {
      if (stats) {
        add(stats, 'cardsDropped', event.cards.length)
        add(
          stats,
          'zeroCardsDropped',
          event.cards.filter(
            (card) => cardValue(card, next.indicator.rank) === 0,
          ).length,
        )
        if (event.type === 'TURN_COMPLETED') {
          if (event.draw === 'none') add(stats, 'matchDrops')
          else
            add(stats, event.draw === 'pickup' ? 'cardsPickedUp' : 'cardsDrawn')
        } else {
          add(stats, 'sevenActions')
          add(stats, 'sevensPlayed', event.cards.length)
          if (event.penalty > 0)
            add(
              stats,
              event.stacked ? 'penaltiesStacked' : 'penaltiesTriggered',
            )
          stats.maxPenalty = Math.max(stats.maxPenalty ?? 0, event.penalty)
        }
      }
    }
    if (event.type === 'POWER_SEVEN_PENALTY_DRAWN' && stats) {
      add(stats, 'penaltyCardsDrawn', event.count)
      add(stats, 'cardsDrawn', event.count)
    }
    if (event.type === 'POWER_SEVEN_CYCLE_COMPLETED') {
      const ids = new Set(
        [
          ...(before?.sevens?.participants ?? []).map(
            (i) => before!.players[i].id,
          ),
          before?.players[before.current]?.id,
        ].filter((id): id is string => !!id),
      )
      ids.forEach((id) =>
        add(c.players.find((p) => p.id === id)!.stats, 'fullCycles'),
      )
    }
    if (event.type === 'SHOW_DECLARED' && stats) {
      add(stats, 'declarations')
      add(stats, 'declaredTotal', event.total)
      if (event.total === 0) add(stats, 'zeroDeclarations')
    }
    if (event.type === 'SHOW_RESOLVED' && stats) {
      add(
        stats,
        event.successful ? 'successfulDeclarations' : 'failedDeclarations',
      )
      if (event.successful) add(stats, 'roundsWon')
      else add(stats, 'failedDeclarationPenalty', 40)
    }
    if (event.type === 'PLAYER_FORFEITED' && stats) {
      add(stats, 'timedOutTurns'); add(stats, 'roundForfeits'); add(stats, 'roundPenalties', event.penalty)
      c.players.find(p => p.id === event.player.id)!.score = event.score
    }
    if (event.type === 'PLAYER_ELIMINATED' && stats) {
      const eliminated = c.players.find((p) => p.id === event.player.id)!
      eliminated.elimination = event.reason
      eliminated.eliminatedAt = now
      add(
        stats,
        event.reason === 'score' ? 'scoreEliminations' : 'timeoutEliminations',
      )
      if (event.reason === 'timeout') add(stats, 'timedOutTurns')
    }
    if (
      manual &&
      stats &&
      before &&
      'player' in event &&
      event.player.id === before.players[before.current].id &&
      [
        'TURN_COMPLETED',
        'POWER_SEVEN_PLAYED',
        'POWER_SEVEN_PENALTY_DRAWN',
        'SHOW_DECLARED',
      ].includes(event.type)
    ) {
      const ms = Math.max(0, now - c.turnStartedAt)
      add(stats, 'completedTurns')
      add(stats, 'decisionMs', ms)
      minimum(stats, 'fastestMs', ms)
      stats.slowestMs = Math.max(stats.slowestMs ?? 0, ms)
    }
    if (event.type === 'ROUND_COMPLETED') {
      c.rounds.push({
        round: event.roundNumber,
        at: now,
        eligibleIds: event.scores
          .filter(
            (score) =>
              c.players.find((p) => p.id === score.id)?.outcome !== 'abandoned',
          )
          .map((score) => score.id),
        reason: event.reason,
        caller: next.result?.caller,
        successful: next.result?.successful,
        scores: event.scores,
      })
      for (const score of event.scores) {
        const p = c.players.find((p) => p.id === score.id)!
        if (p.outcome === 'abandoned') continue
        add(p.stats, 'roundsCompleted')
        if (!score.forfeited) add(p.stats, 'roundPenalties', score.penalty)
        p.score = score.score
        if (event.reason === 'last-player' && next.result?.winners.includes(score.id)) add(p.stats, 'roundsWon')
        minimum(p.stats, 'lowestHand', score.total)
        p.stats.highestHand = Math.max(p.stats.highestHand ?? 0, score.total)
      }
    }
    if (event.type === 'GAME_COMPLETED') {
      c.completedAt = now
      c.status = 'completed'
      const ordered = [...next.players].sort(
        (a, b) =>
          Number(a.eliminated) - Number(b.eliminated) ||
          (c.players.find((p) => p.id === b.id)?.eliminatedAt ?? 0) -
            (c.players.find((p) => p.id === a.id)?.eliminatedAt ?? 0) ||
          a.score - b.score ||
          a.id.localeCompare(b.id),
      )
      for (const p of c.players) {
        p.score = next.players.find((v) => v.id === p.id)!.score
        p.rank = ordered.findIndex((v) => v.id === p.id) + 1
        if (p.outcome !== 'abandoned') {
          p.outcome = p.id === event.winner.id ? 'won' : 'lost'
          add(p.stats, 'finalizedRounds', p.stats.roundsPlayed ?? 0)
          add(p.stats, 'gamesPlayed')
          add(p.stats, p.outcome === 'won' ? 'gamesWon' : 'gamesLost')
        }
      }
    }
  }
  for (const p of c.players)
    p.score = next.players.find((v) => v.id === p.id)!.score
  c.seq = next.eventSequence ?? c.seq
  c.cursor = now
  if (
    !before ||
    next.round !== before.round ||
    next.current !== before.current ||
    !isPlaying(before)
  )
    c.turnStartedAt = now
  if (fresh.length || r.members.some((m) => m.left)) c.revision++
  if (r.members.every((m) => m.left) && !c.completedAt) {
    c.status = 'abandoned'
    c.completedAt = now
    c.revision++
  }
}

/** Snapshot coalesces an outbox: newer revisions contain all unacknowledged rounds and cumulative counters. */
export async function syncCareer(c: CareerState, env: Env) {
  if (!c.eligible || !env.SUPABASE_CAREER_KEY || !env.SUPABASE_URL) return false
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_CAREER_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
    },
  })
  const revision = c.revision
  const sentRounds = new Set(c.rounds.map((round) => round.round))
  const { error } = await client.rpc('ingest_career_match', {
    report: structuredClone(c),
  })
  if (error) return false
  c.syncedRevision = Math.max(c.syncedRevision, revision)
  c.rounds = c.rounds.filter((round) => !sentRounds.has(round.round))
  return true
}

/** Preview URLs must not start reward-bearing games against production storage. */
export function careerOriginAllowed(origin: string, env: Env) {
  if (
    env.CAREER_ENABLED !== 'true' ||
    !env.SUPABASE_CAREER_KEY ||
    !env.CAREER_ORIGIN
  )
    return false
  try {
    return new URL(env.CAREER_ORIGIN).origin === origin
  } catch {
    return false
  }
}
