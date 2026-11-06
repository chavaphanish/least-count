export const LEVEL_BASE = 50
export function xpRequiredForLevel(level: number, base = LEVEL_BASE) {
  return base * (level - 1) * level
}
export function xpProgress(xp: number, base = LEVEL_BASE) {
  const level = Math.floor(
    (1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / base)) / 2,
  )
  const start = xpRequiredForLevel(level, base)
  const next = xpRequiredForLevel(level + 1, base)
  return { level, xp, start, next, earned: xp - start, needed: next - start }
}
export type Metrics = Record<string, number>
export type CareerPlayer = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  levelBase?: number
  createdAt: string
  xp: number
  gamesWon: number
  gamesPlayed: number
  rank: number | null
}
export type Relationship =
  | 'none'
  | 'incoming'
  | 'outgoing'
  | 'accepted'
  | 'blocked'
export type CareerData = {
  profile: CareerPlayer
  own: boolean
  relationship: Relationship
  statistics?: Metrics
  games?: GameReport[]
  opponents?: (CareerPlayer & {
    gamesTogether: number
    wins: number
    losses: number
    lastGame: string
    relationship: Relationship
  })[]
  config: { round: number; game: number; victory: number; levelBase: number }
}
export type GameReport = {
  xp?: number
  id: string
  startedAt: number
  completedAt: number | null
  status: string
  settings: { eliminationThreshold: number; timedGame: boolean }
  roundCount?: number
  rounds: {
    round: number
    at: number
    eligibleIds?: string[]
    reason: string
    caller?: string
    successful?: boolean
    scores: {
      id: string
      name: string
      total: number
      penalty: number
      score: number
    }[]
  }[]
  players: {
    id: string
    name: string
    score: number
    rank: number | null
    outcome: string
    elimination?: 'score' | 'timeout'
    eliminatedAt?: number
    abandonedAt?: number
    stats: Metrics
    xp?: number
  }[]
}
export type Ranking = {
  players: CareerPlayer[]
  me: CareerPlayer | null
  more: boolean
}
export const METRIC_GROUPS: Record<string, Record<string, string>> = {
  Career: {
    gamesStarted: 'Games started',
    gamesPlayed: 'Games finalized',
    gamesWon: 'Games won',
    gamesLost: 'Games lost',
    gamesAbandoned: 'Games abandoned',
    roundsPlayed: 'Rounds participated in',
    roundsCompleted: 'Rounds completed',
    roundsWon: 'Successful Least round wins',
    currentWinStreak: 'Current win streak',
    bestWinStreak: 'Best win streak',
  },
  'Least declarations': {
    declarations: 'Least declarations',
    successfulDeclarations: 'Successful declarations',
    failedDeclarations: 'Failed declarations',
    declaredTotal: 'Sum of declared hand totals',
    zeroDeclarations: 'Zero-point declarations',
    failedDeclarationPenalty: 'Failed Least penalty points',
  },
  'Power Card 7': {
    sevenActions: 'Power Card actions',
    sevensPlayed: 'Physical 7s dropped',
    penaltiesTriggered: 'Penalties triggered',
    penaltiesStacked: 'Penalties stacked',
    penaltyCardsDrawn: 'Penalty cards drawn',
    fullCycles: 'Full-cycle cancellations participated in',
    maxPenalty: 'Largest penalty passed',
  },
  'Card actions': {
    cardsDropped: 'Cards dropped',
    cardsDrawn: 'Cards drawn from Draw Pile',
    cardsPickedUp: 'Cards picked up from Drop Pile',
    matchDrops: 'Match and Drop actions',
    zeroCardsDropped: 'Zero-point cards dropped',
  },
  Scoring: {
    roundPenalties: 'Total round penalty points',
    lowestHand: 'Lowest completed-round hand',
    highestHand: 'Highest completed-round hand',
    scoreEliminations: 'Score eliminations',
    timeoutEliminations: 'Timeout eliminations',
  },
  'Playing time': {
    playingMs: 'Connected active playing time',
    decisionMs: 'Completed-turn decision time',
    completedTurns: 'Player-controlled turns completed',
    fastestMs: 'Fastest completed turn',
    slowestMs: 'Slowest completed turn',
    timedOutTurns: 'Timed-out turns',
  },
}
export function duration(ms: number) {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60_000)
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
