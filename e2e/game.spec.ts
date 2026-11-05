import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createCard } from '../src/game/cards'
import type { Rank } from '../src/game/cards'
import { applyAction, createGame } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import { SESSION_KEY } from '../src/lib/session'
import { botView, chooseBotAction } from '../src/game/bot'

let id = 0
const card = (rank: Rank) => ({
  ...createCard('clubs', rank),
  id: `browser-card-${id++}`,
})
function fixture(count = 3): GameState {
  const s = createGame(
    Array.from({ length: count }, (_, i) => (i ? `Bot ${i}` : 'You')),
  )
  s.current = 0
  s.starter = 0
  s.indicator = createCard('hearts', '9')
  s.players.forEach((p) => {
    p.hand = [card('K'), card('8')]
    p.score = 0
  })
  s.drawPile = [
    card('10'),
    card('6'),
    card('2'),
    card('A'),
    card('8'),
    card('3'),
  ]
  s.discards = [[card('4')]]
  s.eligible = []
  s.deadline = Date.now() + 60_000
  return s
}
async function load(page: Page, game: GameState) {
  await page.goto('/#/game')
  await page.evaluate(
    ({ key, game }) => sessionStorage.setItem(key, JSON.stringify(game)),
    { key: SESSION_KEY, game },
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Your hand', exact: true }),
  ).toBeVisible()
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)!),
    SESSION_KEY,
  )
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
}

for (const width of [1440, 768, 390, 320]) {
  test(`starts an eight-player local game without overflow at ${width}px`, async ({
    page,
  }) => {
    // Hold the initial deal while measuring layout; bot moves are tested below.
    const now = Date.now()
    await page.clock.install({ time: new Date(now) })
    await page.clock.pauseAt(new Date(now + 1000))
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await page.getByRole('link', { name: 'Play Game', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Pull up a chair.' }),
    ).toBeVisible()
    await noOverflow(page)
    await page.getByLabel('Players at the table').selectOption('8')
    await page.getByRole('button', { name: 'Start local game' }).click()
    await expect(
      page.getByRole('group', { name: 'Your hand' }).getByRole('button'),
    ).toHaveCount(7)
    await expect(page.locator('.live-opponent')).toHaveCount(7)
    const opponentCardLabels = await page
      .locator('.live-opponent [role="img"]')
      .evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')))
    expect(
      opponentCardLabels.every((label) => label === 'Face-down card'),
    ).toBe(true)
    await noOverflow(page)
    await page.screenshot({
      path: `/tmp/least-count-playable-${width}.png`,
      fullPage: true,
    })
    expect(errors).toEqual([])
  })
}

test('plans without changing the pile or hand, survives refresh, then commits both actions', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const game = fixture()
  game.players[0].hand = [card('K'), card('K'), card('A')]
  game.eligible = game.discards[0].map((c) => c.id)
  await load(page, game)
  const selectKings = async () => {
    const kings = page
      .getByRole('group', { name: 'Your hand' })
      .getByRole('button', { name: /^K of/ })
    await kings.nth(0).click()
    await kings.nth(1).click()
    await page.getByRole('button', { name: 'Choose draw source (2)' }).click()
  }
  await selectKings()
  await expect(
    page.getByRole('button', { name: 'Draw from pile', exact: true }),
  ).toBeFocused()
  await expect(
    page
      .locator('[data-discard-target]')
      .getByRole('img', { name: '4 of clubs' }),
  ).toBeVisible()
  expect(await saved(page)).toEqual(game)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Draw from pile', exact: true }),
  ).toHaveCount(0)
  expect((await saved(page)).deadline).toBe(game.deadline)
  await selectKings()
  await page.getByRole('button', { name: 'Back to selection' }).click()
  expect(await saved(page)).toEqual(game)
  await page.getByRole('button', { name: 'Choose draw source (2)' }).click()
  await page.getByRole('button', { name: 'Pick up 4 of clubs' }).click()
  const next = await saved(page)
  expect(next.players[0].hand.map((c) => c.rank)).toEqual(['A', '4'])
  expect(next.current).toBe(1)
  await expect(page.getByTestId('turn-animation')).toHaveCount(0)
})

test('rejects mixed ranks without changing the turn or deadline', async ({
  page,
}) => {
  const game = fixture()
  await load(page, game)
  const cards = page
    .getByRole('group', { name: 'Your hand' })
    .getByRole('button')
  await cards.nth(0).click()
  await cards.nth(1).click()
  await page.getByRole('button', { name: 'Choose draw source (2)' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'All selected cards must have the same rank.',
  )
  const next = await saved(page)
  expect(next.players[0].hand).toEqual(game.players[0].hand)
  expect(next.deadline).toBe(game.deadline)
  expect(next.phase).toBe('turn')
})

test('Match and Drop skips the draw and lets the next simulated player act', async ({
  page,
}) => {
  const game = fixture()
  game.players[0].hand = [card('4'), card('4'), card('K')]
  await load(page, game)
  const cards = page
    .getByRole('group', { name: 'Your hand' })
    .getByRole('button', { name: /^4 of/ })
  await cards.nth(0).click()
  await cards.nth(1).click()
  await page.getByRole('button', { name: 'Match & Drop (2)' }).click()
  expect((await saved(page)).players[0].hand).toHaveLength(1)
  await expect
    .poll(async () =>
      (await saved(page)).log.some((line) => line.includes('Bot 1 discarded')),
    )
    .toBe(true)
})

test('zero-point Show ties preserve scores at 99 and start another ordinary round', async ({
  page,
}) => {
  const game = fixture(2)
  game.players[0].hand = []
  game.players[1].hand = [card('9')]
  game.players.forEach((p) => {
    p.score = 99
  })
  await load(page, game)
  await page.getByRole('button', { name: 'Call Show' }).click()
  await expect(
    page.getByRole('heading', { name: 'Show! Lowest hand wins the round.' }),
  ).toBeFocused()
  expect((await saved(page)).players.map((p) => p.score)).toEqual([99, 99])
  await expect(page.getByRole('table')).toBeVisible()
  await noOverflow(page)
  await page.getByRole('button', { name: 'Start round 2' }).click()
  const next = await saved(page)
  expect(next.round).toBe(2)
  expect(next.players.map((p) => p.score)).toEqual([99, 99])
})

test('accepts a 7 penalty and clears open-pickup eligibility', async ({
  page,
}) => {
  const game = fixture()
  game.players[0].hand = [card('7'), card('K')]
  game.phase = 'penalty'
  game.sevens = { initiator: 2, participants: [2, 1], amount: 4 }
  game.discards = [[card('7')]]
  game.eligible = game.discards[0].map((c) => c.id)
  await load(page, game)
  await expect(page.getByRole('button', { name: /^K of/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Draw 4 penalty cards' }).click()
  const next = await saved(page)
  expect(next.players[0].hand).toHaveLength(6)
  expect(next.eligible).toEqual([])
  expect(next.sevens).toBeNull()
  expect(next.current).toBe(1)
})

test('plays a responding 7 and cancels a full cycle', async ({ page }) => {
  const game = fixture(2)
  game.players[0].hand = [card('7'), card('K')]
  game.phase = 'penalty'
  game.sevens = { initiator: 1, participants: [1], amount: 2 }
  game.discards = [[card('7')]]
  await load(page, game)
  await page.getByRole('button', { name: /^7 of/ }).click()
  await page.getByRole('button', { name: 'Play selected 7s (1)' }).click()
  const next = await saved(page)
  expect(next.current).toBe(1)
  expect(next.phase).toBe('turn')
  expect(next.sevens).toBeNull()
  expect(next.log.some((line) => line.includes('Full cycle'))).toBe(true)
})

test('enforces the original deadline after reload and records a timeout match winner', async ({
  page,
}) => {
  const game = fixture(2)
  game.deadline = Date.now() - 1
  await load(page, game)
  await expect(
    page.getByRole('heading', { name: 'Bot 1 wins the match!' }),
  ).toBeVisible()
  const next = await saved(page)
  expect(next.players[0].eliminationReason).toBe('timeout')
  expect(next.players[0].hand).toEqual([])
  expect(next.phase).toBe('game-over')
})

test('the live timer eliminates on expiry without a refresh', async ({
  page,
}) => {
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  const game = fixture(2)
  game.deadline = now + 60_000
  await load(page, game)
  await page.clock.fastForward(60_000)
  await expect(
    page.getByRole('heading', { name: 'Bot 1 wins the match!' }),
  ).toBeVisible()
})

test('rules, downloads, and keyboard skip navigation work on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/#/rules')
  await expect(
    page.getByRole('heading', { name: 'Know your table.' }),
  ).toBeVisible()
  await noOverflow(page)
  const download = page.getByRole('link', {
    name: 'Download confirmed decisions',
  })
  const response = await page.request.get(
    (await download.getAttribute('href'))!,
  )
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain('Confirmed — penalty draw')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  expect(page.url()).toContain('#/rules')
})

test('plays a complete local match through the real controls', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    let seed = 42
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
  })
  await page.clock.install({ time: new Date() })
  await page.goto('/#/game')
  await page.getByLabel('Players at the table').selectOption('2')
  await page.getByRole('button', { name: 'Start local game' }).click()
  let steps = 0
  while (steps++ < 1500) {
    const game = await saved(page)
    if (game.phase === 'game-over') {
      expect(game.players.filter((p) => !p.eliminated)).toHaveLength(1)
      expect(game.players.every((p) => p.eliminationReason !== 'timeout')).toBe(
        true,
      )
      await expect(
        page.getByRole('heading', { name: /win[s]? the match!/ }),
      ).toBeVisible()
      return
    }
    if (game.phase === 'round-over') {
      await page
        .getByRole('button', { name: `Start round ${game.round + 1}` })
        .click()
    } else if (game.current !== 0) {
      await page.clock.runFor(900)
    } else {
      // Choose from the human's own cards and public information; interact via UI.
      const action = chooseBotAction(botView(game))
      if (action.type === 'show')
        await page.getByRole('button', { name: 'Call Show' }).click()
      if (action.type === 'discard') {
        const buttons = page
          .getByRole('group', { name: 'Your hand' })
          .getByRole('button')
        for (const id of action.cardIds)
          await buttons
            .nth(game.players[0].hand.findIndex((c) => c.id === id))
            .click()
        await page
          .getByRole('button', {
            name: /^(Choose draw source|Match & Drop|Play selected 7s)/,
          })
          .click()
        if (
          await page
            .getByRole('button', { name: 'Draw from pile', exact: true })
            .isVisible()
        ) {
          const draw = chooseBotAction({ ...botView(game), phase: 'draw' })
          if (draw.type !== 'draw')
            throw new Error('Expected a replacement choice.')
          if (draw.source === 'pile')
            await page
              .getByRole('button', { name: 'Draw from pile', exact: true })
              .click()
          else {
            const index = game.discards
              .flat()
              .filter((c) => game.eligible.includes(c.id))
              .findIndex((c) => c.id === draw.cardId)
            await page.locator('.pickup-button').nth(index).click()
          }
        }
      }
      if (action.type === 'draw') {
        if (action.source === 'pile')
          await page
            .getByRole('button', { name: 'Draw from pile', exact: true })
            .click()
        else {
          const index = game.discards
            .flat()
            .filter((c) => game.eligible.includes(c.id))
            .findIndex((c) => c.id === action.cardId)
          await page.locator('.pickup-button').nth(index).click()
        }
      }
      if (action.type === 'accept-penalty')
        await page
          .getByRole('button', { name: /^Draw \d+ penalty cards$/ })
          .click()
    }
  }
  throw new Error('The local match did not finish within 1500 actions.')
})

test('animates outgoing cards and an open pickup concurrently after committing once', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1500 })
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  await page.clock.pauseAt(new Date(now + 1000))
  const game = fixture()
  game.players[0].hand = [card('K'), card('K'), card('A')]
  game.eligible = game.discards[0].map((c) => c.id)
  await load(page, game)
  const cards = page
    .getByRole('group', { name: 'Your hand' })
    .getByRole('button', { name: /^K of/ })
  await cards.nth(0).click()
  await cards.nth(1).click()
  await page.getByRole('button', { name: 'Choose draw source (2)' }).click()
  await page.getByRole('button', { name: 'Pick up 4 of clubs' }).click()
  await expect(page.locator('.flight-outgoing')).toHaveCount(2)
  await expect(page.locator('.flight-incoming')).toHaveCount(1)
  const timings = await page
    .locator('.card-flight')
    .evaluateAll(async (elements) => {
      const animations = elements.map((element) => element.getAnimations()[0])
      await Promise.all(animations.map((animation) => animation.ready))
      return animations.map((animation) => ({
        start: animation.startTime,
        duration: animation.effect!.getTiming().duration,
        delay: animation.effect!.getTiming().delay,
      }))
    })
  expect(
    timings.every(
      (t) => t.start !== null && t.duration === 650 && t.delay === 0,
    ),
  ).toBe(true)
  const starts = timings.map((t) => Number(t.start))
  expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(25)
  expect((await saved(page)).players[0].hand.map((c) => c.rank)).toEqual([
    'A',
    '4',
  ])
  await expect(page.locator('.flight-incoming [role="img"]')).toHaveAttribute(
    'aria-label',
    '4 of clubs',
  )
  await expect(
    page.getByRole('button', { name: 'New game', exact: true }),
  ).toBeDisabled()
  await page.locator('.card-flight').evaluateAll((elements) =>
    elements.forEach((element) =>
      element.getAnimations().forEach((animation) => {
        animation.pause()
        animation.currentTime = 325
      }),
    ),
  )
  await page.screenshot({
    path: '/tmp/least-count-card-exchange.png',
    fullPage: false,
  })
  await expect(page.locator('.flight-outgoing')).toHaveCount(2)
  await page.clock.runFor(650)
  await expect(page.getByTestId('turn-animation')).toHaveCount(0)
  expect((await saved(page)).players[0].hand).toHaveLength(2)
})

test('keeps a closed-pile card face down in flight and preserves the accepted move through reload', async ({
  page,
}) => {
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  await page.clock.pauseAt(new Date(now + 1000))
  const game = fixture()
  await load(page, game)
  await page.getByRole('button', { name: /^K of/ }).click()
  await page.getByRole('button', { name: 'Choose draw source (1)' }).click()
  await page
    .getByRole('button', { name: 'Draw from pile', exact: true })
    .click()
  await expect(page.locator('.flight-incoming [role="img"]')).toHaveAttribute(
    'aria-label',
    'Face-down card',
  )
  const committed = await saved(page)
  await page.reload()
  await expect(page.getByTestId('turn-animation')).toHaveCount(0)
  expect(await saved(page)).toEqual(committed)
  expect(committed.players[0].hand).toHaveLength(2)
})

test('restores an older save with a discard already awaiting a draw', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const game = fixture()
  game.eligible = game.discards[0].map((c) => c.id)
  const pending = applyAction(game, {
    type: 'discard',
    playerId: 'p0',
    cardIds: [game.players[0].hand[0].id],
  })
  await load(page, pending)
  await page.getByRole('button', { name: 'Pick up 4 of clubs' }).click()
  expect((await saved(page)).players[0].hand.map((c) => c.rank)).toEqual([
    '8',
    '4',
  ])
})

test('keeps the deadline running while the draw source is being chosen', async ({
  page,
}) => {
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  const game = fixture(2)
  game.deadline = now + 60_000
  await load(page, game)
  await page.getByRole('button', { name: /^K of/ }).click()
  await page.getByRole('button', { name: 'Choose draw source (1)' }).click()
  await page.clock.fastForward(60_000)
  await expect(
    page.getByRole('heading', { name: 'Bot 1 wins the match!' }),
  ).toBeVisible()
  const next = await saved(page)
  expect(next.players[0].eliminationReason).toBe('timeout')
  expect(next.discards).toEqual(game.discards)
  await expect(page.getByTestId('turn-animation')).toHaveCount(0)
})

test('keeps the previous group and all pickup choices usable on a narrow phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const game = fixture()
  game.players[0].hand = [card('K'), card('K'), card('A')]
  const suits = ['clubs', 'diamonds', 'hearts', 'spades'] as const
  game.discards = [
    Array.from({ length: 8 }, (_, index) => ({
      ...card('4'),
      suit: suits[index % 4],
    })),
  ]
  game.eligible = game.discards[0].map((c) => c.id)
  await load(page, game)
  const kings = page
    .getByRole('group', { name: 'Your hand' })
    .getByRole('button', { name: /^K of/ })
  await kings.nth(0).click()
  await kings.nth(1).click()
  await page.getByRole('button', { name: 'Choose draw source (2)' }).click()
  await expect(page.locator('.pickup-button')).toHaveCount(8)
  await noOverflow(page)
  expect((await saved(page)).players[0].hand).toHaveLength(3)
  await page.screenshot({
    path: '/tmp/least-count-pickup-choice-mobile.png',
    fullPage: true,
  })
  await page.locator('.pickup-button').nth(1).click()
  await expect(page.getByTestId('turn-animation')).toHaveCount(0)
  expect((await saved(page)).players[0].hand.map((c) => c.rank)).toEqual([
    'A',
    '4',
  ])
})
