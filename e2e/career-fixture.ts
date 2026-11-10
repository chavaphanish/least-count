import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
const uid = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222',
  gid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGMw6on6D8IMMAYARuQIXZeBPNsAAAAASUVORK5CYII=',
  'base64',
)
export async function mock(page: Page) {
  const user = {
    player: {
      id: `user:${uid}`,
      displayName: 'Career Tester',
      avatarUrl: null as string | null,
      accountType: 'registered',
    },
    email: 'owner-private@example.test',
    createdAt: '2026-01-01T00:00:00Z',
    lastActiveAt: '2026-11-06T00:00:00Z',
  }
  const me = {
    id: uid,
    username: 'lc_owner',
    displayName: user.player.displayName,
    avatarUrl: null as string | null,
    createdAt: user.createdAt,
    xp: 1250,
    gamesWon: 18,
    gamesPlayed: 25,
    rank: 124,
    levelBase: 50,
  }
  const friend = {
    ...me,
    id: other,
    username: 'lc_other',
    displayName: 'Other Player',
    xp: 1500,
    rank: 1,
  }
  let relationship = 'none'
  const game = {
    id: gid,
    startedAt: 1000,
    completedAt: 120000,
    status: 'completed',
    settings: { timedGame: true, eliminationThreshold: 100 },
    xp: 150,
    players: [
      {
        id: `user:${uid}`,
        name: 'Career Tester',
        score: 0,
        rank: 1,
        outcome: 'won',
        stats: { playingMs: 119000, completedTurns: 3, decisionMs: 9000 },
      },
      {
        id: `user:${other}`,
        name: 'Other Player',
        score: 100,
        rank: 2,
        outcome: 'lost',
        stats: {},
      },
    ],
    rounds: [
      {
        round: 1,
        at: 120000,
        reason: 'show',
        caller: `user:${uid}`,
        successful: true,
        scores: [
          {
            id: `user:${uid}`,
            name: 'Career Tester',
            total: 0,
            penalty: 0,
            score: 0,
          },
          {
            id: `user:${other}`,
            name: 'Other Player',
            total: 10,
            penalty: 10,
            score: 100,
          },
        ],
      },
    ],
  }
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { supabase: null, service: 'least-count' } }),
  )
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user, room: null } }),
  )
  await page.route('**/api/profile', (route) => {
    user.player.displayName = route.request().postDataJSON().displayName
    return route.fulfill({ json: { user } })
  })
  await page.route('**/test-avatar-*.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  )
  await page.route('**/api/career**', async (route) => {
    const op = new URL(route.request().url()).searchParams.get('op')
    const data = {
      profile: {
        ...me,
        avatarUrl: user.player.avatarUrl,
        displayName: user.player.displayName,
      },
      own: true,
      relationship: 'none',
      statistics: {
        gamesStarted: 26,
        gamesPlayed: 25,
        gamesWon: 18,
        roundsPlayed: 100,
        roundsCompleted: 98,
        declarations: 25,
        successfulDeclarations: 18,
        declaredTotal: 75,
        completedTurns: 10,
        decisionMs: 84000,
        playingMs: 52320000,
        currentWinStreak: 3,
      },
      config: { round: 10, game: 25, victory: 75, levelBase: 50 },
      games: [game],
      opponents: [
        {
          ...friend,
          gamesTogether: 12,
          wins: 8,
          losses: 3,
          lastGame: '2026-11-06',
          relationship,
        },
      ],
    }
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON()
      expect(input.id).toBe(other)
      relationship =
        input.action === 'request'
          ? 'outgoing'
          : input.action === 'accept'
            ? 'accepted'
            : input.action === 'block'
              ? 'blocked'
              : 'none'
      return route.fulfill({ json: { relationship } })
    }
    if (op === 'leaderboard')
      return route.fulfill({ json: { players: [friend], me, more: false } })
    if (op === 'public')
      return route.fulfill({
        json: {
          profile: friend,
          own: false,
          relationship,
          config: data.config,
        },
      })
    if (op === 'search')
      return route.fulfill({ json: [{ ...friend, relationship }] })
    if (op === 'buddies')
      return route.fulfill({
        json: {
          players:
            relationship === 'accepted' ||
            relationship === 'incoming' ||
            relationship === 'outgoing'
              ? [{ ...friend, relationship }]
              : [],
          blocked: relationship === 'blocked' ? [friend] : [],
        },
      })
    if (op === 'game') return route.fulfill({ json: game })
    return route.fulfill({ json: data })
  })
  return {
    user,
    me,
    friend,
    game,
    setRelationship: (value: string) => {
      relationship = value
    },
  }
}
