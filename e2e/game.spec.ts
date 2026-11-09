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
  s.phase = 'turn'
  s.sevens = null
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
  s.eligible = s.discards[0].map((c) => c.id)
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
    // Hold later bot moves; an opening 7 may already trigger a mandatory draw during dealing.
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
    const dealt = await saved(page)
    const automaticPenalty = dealt.events?.find(
      event => event.type === 'POWER_SEVEN_PENALTY_DRAWN' && event.player.id === 'p0',
    )
    const openingPenalty = automaticPenalty?.type === 'POWER_SEVEN_PENALTY_DRAWN' ? automaticPenalty.count : 0
    expect([0, 2]).toContain(openingPenalty)
    await expect(
      page.getByRole('group', { name: 'Your hand' }).getByRole('button'),
    ).toHaveCount(7 + openingPenalty)
    await expect(page.locator('.live-opponent')).toHaveCount(7)
    const opponentCardLabels = await page
      .locator('.live-opponent [role="img"]')
      .evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')))
    expect(
      opponentCardLabels.every((label) => label === 'Face-down card'),
    ).toBe(true)
    await noOverflow(page)
    const activeSeat = page.locator('.opponent-row .active-seat')
    if (await activeSeat.count()) {
      const bounds = await activeSeat.evaluate(seat => {
        const card = seat.getBoundingClientRect()
        const row = seat.parentElement!.getBoundingClientRect()
        return { left: card.left - row.left, right: row.right - card.right }
      })
      expect(bounds.left).toBeGreaterThanOrEqual(-1)
      expect(bounds.right).toBeGreaterThanOrEqual(-1)
    }
    await page.screenshot({
      path: `/tmp/least-count-playable-${width}.png`,
      fullPage: true,
    })
    expect(errors).toEqual([])
  })
}

test('commits the discard first, preserves the prior pickup across refresh, then draws once', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const game = fixture()
  game.players[0].hand = [card('K'), card('K'), card('A')]
  game.eligible = game.discards[0].map((c) => c.id)
  await load(page, game)
  await expect(
    page.getByRole('button', { name: 'Draw New Card', exact: true }),
  ).toHaveCount(0)
  const kings = page
    .getByRole('group', { name: 'Your hand' })
    .getByRole('button', { name: /^K of/ })
  await kings.nth(0).click()
  await kings.nth(1).click()
  await page
    .getByRole('button', { name: 'Drop 2 Kings', exact: true })
    .click()
  const waiting = await saved(page)
  expect(waiting.phase).toBe('draw')
  expect(waiting.players[0].hand.map((c) => c.rank)).toEqual(['A'])
  expect(waiting.drawPile).toEqual(game.drawPile)
  expect(waiting.deadline).toBe(game.deadline)
  await expect(
    page
      .locator('[data-discard-target]')
      .getByRole('img', { name: 'K of clubs' }),
  ).toHaveCount(2)
  await page.reload()
  expect((await saved(page)).phase).toBe('draw')
  await expect(
    page.getByRole('button', { name: 'Back to selection' }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Pick up 4 of clubs', exact: true })
    .click()
  const done = await saved(page)
  expect(done.players[0].hand.map((c) => c.rank)).toEqual(['A', '4'])
  expect(done.current).toBe(1)
})

test('selecting a different rank replaces the selection without changing the turn or deadline', async ({ page }) => {
  const game = fixture()
  await load(page, game)
  const cards = page.getByRole('group', { name: 'Your hand' }).getByRole('button')
  await cards.nth(0).click()
  await cards.nth(1).click()
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'false')
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Drop 1 Card', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Drop 2 4s' }).click()
  expect((await saved(page)).players[0].hand).toHaveLength(1)
  await expect
    .poll(async () =>
      (await saved(page)).log.some((line) => line.includes('Bot 1 dropped')),
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
  await page.getByRole('button', { name: 'Declare Least' }).click()
  await expect(
    page.getByRole('heading', { name: 'Least successful! Lowest hand wins the round.' }),
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
  await page.getByRole('button', { name: 'Draw 4 Penalty Cards' }).click()
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
  game.eligible = []
  await load(page, game)
  await page.getByRole('button', { name: /^7 of/ }).click()
  await page.getByRole('button', { name: 'Play 7' }).click()
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
        await page.getByRole('button', { name: 'Declare Least' }).click()
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
            name: /^(Drop|Play)/,
          })
          .click()
        if (
          await page
            .getByRole('button', { name: 'Draw New Card', exact: true })
            .isVisible()
        ) {
          const draw = chooseBotAction({ ...botView(game), phase: 'draw' })
          if (draw.type !== 'draw')
            throw new Error('Expected a replacement choice.')
          if (draw.source === 'pile')
            await page
              .getByRole('button', { name: 'Draw New Card', exact: true })
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
            .getByRole('button', { name: 'Draw New Card', exact: true })
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
          .getByRole('button', { name: /^Draw \d+ Penalty Cards$/ })
          .click()
    }
  }
  throw new Error('The local match did not finish within 1500 actions.')
})

test('finishes discard animation before allowing the public pickup animation', async ({
  page,
}) => {
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  await page.clock.pauseAt(new Date(now + 1000))
  const game = fixture()
  game.players[0].hand = [card('K'), card('K'), card('A')]
  game.eligible = game.discards[0].map((c) => c.id)
  await load(page, game)
  const kings = page
    .getByRole('group', { name: 'Your hand' })
    .getByRole('button', { name: /^K of/ })
  await kings.nth(0).click()
  await kings.nth(1).click()
  await page
    .getByRole('button', { name: 'Drop 2 Kings', exact: true })
    .click()
  await expect(page.locator('.flight-outgoing')).toHaveCount(2)
  await expect(page.locator('.flight-incoming')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Pick up 4 of clubs', exact: true }),
  ).toHaveCount(0)
  const waiting = await saved(page)
  expect(waiting.phase).toBe('draw')
  expect(waiting.players[0].hand.map((c) => c.rank)).toEqual(['A'])
  expect(waiting.drawPile).toEqual(game.drawPile)
  await page.clock.runFor(650)
  await page
    .getByRole('button', { name: 'Pick up 4 of clubs', exact: true })
    .click()
  await expect(page.locator('.flight-outgoing')).toHaveCount(0)
  await expect(page.locator('.flight-incoming')).toHaveCount(1)
  await expect(page.locator('.flight-incoming [role="img"]')).toHaveAttribute(
    'aria-label',
    '4 of clubs',
  )
  expect((await saved(page)).players[0].hand.map((c) => c.rank)).toEqual([
    'A',
    '4',
  ])
  await page.clock.runFor(650)
  await expect(page.getByTestId('turn-animation')).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Drop 1 Card' }).click()
  await page.clock.runFor(650)
  await page
    .getByRole('button', { name: 'Draw New Card', exact: true })
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
  await page.getByRole('button', { name: 'Drop 1 Card' }).click()
  await page.clock.fastForward(60_000)
  await expect(
    page.getByRole('heading', { name: 'Bot 1 wins the match!' }),
  ).toBeVisible()
  const next = await saved(page)
  expect(next.players[0].eliminationReason).toBe('timeout')
  expect(next.discards.at(-1)![0].rank).toBe('K')
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
  await page.getByRole('button', { name: 'Drop 2 Kings' }).click()
  await expect(page.locator('.pickup-button')).toHaveCount(8)
  await noOverflow(page)
  expect((await saved(page)).players[0].hand).toHaveLength(1)
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

test('automatic replacement animates after the discard, never alongside it', async ({
  page,
}) => {
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  await page.clock.pauseAt(new Date(now + 1000))
  const s = fixture()
  s.eligible = []
  await load(page, s)
  await page.getByRole('button', { name: /^K of/ }).click()
  await page
    .getByRole('button', {
      name: 'Drop 1 Card',
      exact: true,
    })
    .click()
  await expect(page.locator('.flight-outgoing')).toHaveCount(1)
  await expect(page.locator('.flight-incoming')).toHaveCount(0)
  await page.clock.runFor(325)
  await expect(page.locator('.flight-outgoing')).toHaveCount(0)
  await expect(page.locator('.flight-incoming')).toHaveCount(1)
  await expect(page.locator('.flight-incoming [role="img"]')).toHaveAttribute(
    'aria-label',
    'Face-down card',
  )
  await expect(
    page
      .locator('[data-discard-target]')
      .getByRole('img', { name: 'K of clubs' }),
  ).toBeVisible()
  await page.clock.runFor(325)
  await expect(page.getByTestId('turn-animation')).toHaveCount(0)
  expect((await saved(page)).players[0].hand).toHaveLength(2)
})

for (const width of [320, 768, 1440]) {
  for (const count of [7, 14, 21]) {
    test(`overlapping ${count}-card hand stays selectable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1100 })
      const now = Date.now()
      await page.clock.install({ time: new Date(now) })
      await page.clock.pauseAt(new Date(now + 1000))
      const game = fixture(2)
      game.players[0].hand = Array.from({ length: count }, (_, i) => card(i % 2 ? '10' : 'K'))
      await load(page, game)
      const hand = page.getByRole('group', { name: 'Your hand' })
      const buttons = hand.getByRole('button')
      await expect(buttons).toHaveCount(count)
      await expect(hand.locator('.hand-row')).toHaveCount(Math.ceil(count / 7))
      await expect(hand.locator('.card-value')).toHaveCount(0)
      await expect(page.getByTestId('hand-total')).toHaveText(`${count * 10} points`)
      const geometry = await hand.locator('.hand-row').first().locator('.playing-card').evaluateAll(cards =>
        cards.map(card => {
          const box = card.getBoundingClientRect()
          const corner = card.querySelector('.card-corner')!.getBoundingClientRect()
          return { left: box.left, right: box.right, cornerRight: corner.right }
        }),
      )
      geometry.slice(0, -1).forEach((box, i) => {
        expect(box.right).toBeGreaterThan(geometry[i + 1].left)
        expect(box.cornerRight).toBeLessThanOrEqual(geometry[i + 1].left)
      })
      for (let i = 0; i < count; i++) {
        // Default center clicks must hit each exposed strip, including adjacent selected cards.
        await buttons.nth(i).click()
        await expect(buttons.nth(i)).toHaveAttribute('aria-pressed', 'true')
      }
      await buttons.first().click()
      await buttons.first().focus()
      await page.keyboard.press('Space')
      await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false')
      await page.keyboard.press('Enter')
      await expect(buttons.first()).toHaveAttribute('aria-pressed', 'true')
      await expect(buttons.first()).toHaveClass(/selected-card/)
      await expect.poll(() => buttons.first().evaluate(card =>
        new DOMMatrixReadOnly(getComputedStyle(card).transform).m42,
      )).toBeLessThan(-11)
      await expect(page.locator('.hand-player .profile-avatar')).toHaveText('YO')
      await expect(page.getByText('Round Joker · 9', { exact: true })).toBeVisible()
      await noOverflow(page)
      await page.mouse.move(0, 0)
      await page.locator('.your-live-seat').screenshot({ path: `/tmp/least-count-hand-${width}-${count}.png` })
    })
  }
}

test('own hand uses restored profile image and falls back to initials after an image error', async ({ page }) => {
  await page.route('**/api/config', route => route.fulfill({ json: { supabase: null, service: 'least-count' } }))
  await page.route('**/api/session', route => route.fulfill({ json: {
    user: { player: { id: 'user:test', displayName: 'Profile Tester', avatarUrl: '/test-avatar.svg', accountType: 'registered' }, email: 'test@example.test', createdAt: '2026-01-01', lastActiveAt: '2026-01-01' },
    room: null,
  } }))
  let broken = false
  await page.route('**/test-avatar.svg', route => broken
    ? route.fulfill({ status: 404 })
    : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="green"/></svg>' }))
  await load(page, fixture())
  const identity = page.locator('.hand-player')
  await expect(identity).toContainText('Profile Tester')
  await expect(identity.getByRole('img', { name: "Profile Tester's profile picture" })).toBeVisible()
  broken = true
  await page.reload()
  await expect(identity.locator('img')).toHaveCount(0)
  await expect(identity.locator('.profile-avatar')).toHaveText('PR')
})


test('touch users can select and deselect adjacent overlapping cards', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })
  try {
    const page = await context.newPage()
    const game = fixture(2)
    game.players[0].hand = Array.from({ length: 7 }, () => card('10'))
    await load(page, game)
    const buttons = page.locator('.player-hand button')
    await buttons.nth(0).tap()
    await buttons.nth(1).tap()
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await buttons.nth(0).tap()
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false')
    await noOverflow(page)
  } finally {
    await context.close()
  }
})

test('guided actions support matching groups, legal declaration choices, and relevant phases only', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const game = fixture(2)
  game.players[0].hand = [card('Q'), card('Q'), card('A')]
  await load(page, game)
  const bar = page.getByRole('region', { name: 'Turn actions' })
  await expect(bar.getByText('Select cards to drop', { exact: true })).toBeVisible()
  await expect(bar.getByRole('button', { name: 'Drop Selected Cards' })).toBeDisabled()
  await expect(bar.getByRole('button', { name: 'Declare Least' })).toHaveCount(0)
  await expect(bar.getByRole('button', { name: 'Draw New Card' })).toHaveCount(0)
  await page.locator('.hand-card').first().click()
  await bar.getByRole('button', { name: 'Select All Matching' }).click()
  await expect(page.locator('.hand-card[aria-pressed="true"]')).toHaveCount(2)
  await bar.getByRole('button', { name: 'Drop 2 Queens' }).click()
  await expect(bar.getByText('CHOOSE YOUR REPLACEMENT CARD', { exact: true })).toBeVisible()
  await expect(bar.getByRole('button', { name: 'Declare Least' })).toHaveCount(0)
  await expect(bar.locator('[data-plan-discard]')).toHaveCount(0)
  await expect(bar.getByRole('button', { name: 'Draw New Card' })).toBeEnabled()
  await expect(bar.locator('.pickup-button')).toContainText('Pick Up 4♣')
  await bar.getByRole('button', { name: 'Pick up 4 of clubs' }).click()
  await expect(bar.locator('button')).toHaveCount(0)
  await expect(bar.getByRole('status').first()).toContainText('Waiting for Bot 1')
  const eligible = fixture(2)
  eligible.players[0].hand = [card('A'), card('2')]
  await load(page, eligible)
  await expect(bar.getByRole('button', { name: 'Declare Least' })).toBeEnabled()
  await page.locator('.hand-card').first().click()
  await expect(bar.getByRole('button', { name: 'Drop 1 Card' })).toBeEnabled()
  await expect(bar.getByRole('button', { name: 'Declare Least' })).toBeEnabled()
  await expect(page.locator('main')).not.toContainText(/\bdiscard(?:ed|s|ing)?\b|\bShow\b/i)
})

test('power response offers only sevens and the current penalty', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const game = fixture(2)
  game.phase = 'penalty'
  game.sevens = { initiator: 1, amount: 4, participants: [1] }
  game.players[0].hand = [card('7'), card('7'), card('A')]
  await load(page, game)
  const bar = page.getByRole('region', { name: 'Turn actions' })
  await expect(bar.getByText('POWER CARD 7', { exact: true })).toBeVisible()
  await expect(bar.getByRole('button', { name: 'Declare Least' })).toHaveCount(0)
  await expect(bar.getByRole('button', { name: 'Drop Selected Cards' })).toHaveCount(0)
  await expect(bar.getByRole('button', { name: 'Draw 4 Penalty Cards' })).toBeEnabled()
  await expect(page.locator('.hand-card').last()).toBeDisabled()
  await page.locator('.hand-card').first().click()
  await bar.getByRole('button', { name: 'Select All Matching' }).click()
  await expect(bar.getByRole('button', { name: 'Play 2 Sevens' })).toBeEnabled()
})

test('timer warnings follow the same deadline and disappear for untimed games', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  // Keep navigation time from consuming the one-second warning-boundary margin.
  await page.clock.pauseAt(new Date(now + 1000))
  const game = fixture(2)
  game.deadline = now + 17_000
  await load(page, game)
  await expect(page.getByRole('timer')).not.toHaveClass(/clock-warning|clock-urgent/)
  await page.clock.fastForward(1500)
  await expect(page.getByRole('timer')).toHaveClass(/clock-warning/)
  await page.clock.fastForward(10_000)
  await expect(page.getByRole('timer')).toHaveClass(/clock-urgent/)
  expect((await saved(page)).deadline).toBe(game.deadline)
  const untimed = fixture(2)
  untimed.settings = { ...untimed.settings!, timedGame: false }
  untimed.deadline = null
  await load(page, untimed)
  await expect(page.getByRole('timer')).toHaveCount(0)
})


test('active opponent and countdown stay in the seat strip after a phone resize', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const now = Date.now()
  await page.clock.install({ time: new Date(now) })
  await page.clock.pauseAt(new Date(now + 1000))
  const game = fixture(8)
  game.current = 7
  await load(page, game)
  await page.setViewportSize({ width: 320, height: 1100 })
  await expect.poll(() => page.locator('.active-seat').evaluate(seat => {
    const box = seat.getBoundingClientRect()
    const row = seat.parentElement!.getBoundingClientRect()
    return box.left >= row.left - 1 && box.right <= row.right + 1
  })).toBe(true)
  await expect(page.locator('.active-seat').getByRole('timer')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Turn actions' })).toContainText('Waiting for Bot 7')
  await expect(page.getByRole('region', { name: 'Turn actions' }).locator('button')).toHaveCount(0)
  await noOverflow(page)
})
