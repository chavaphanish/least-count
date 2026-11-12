import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
async function guest(page: Page, name: string) {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Continue as Guest', exact: true })
    .click()
  await page.getByLabel('Display name', { exact: true }).fill(name)
  await page
    .getByRole('button', { name: 'Enter as guest', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: `Welcome, ${name}.` }),
  ).toBeVisible()
}
async function create(page: Page, capacity = 2, timed = false, cutoff = 100) {
  await page.getByRole('button', { name: /Set the Table/ }).click()
  await page.getByLabel('Number of players').selectOption(String(capacity))
  await page.getByLabel('Elimination cutoff').fill(String(cutoff))
  if (!timed) await page.getByLabel('Timed game').uncheck()
  await page.getByRole('button', { name: 'Create Room', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Waiting lobby' }),
  ).toBeVisible()
  await expect(
    page.getByText(`1 connected · 1 of ${capacity} seats reserved`),
  ).toBeVisible()
  return (await page.locator('.room-code-panel strong').textContent())!
}
async function enter(page: Page, code: string) {
  await page.getByRole('button', { name: /Take a Seat/ }).click()
  await page.getByLabel('Room code', { exact: true }).fill(code.toLowerCase())
  await page.getByRole('button', { name: 'Join Room', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Waiting lobby' }),
  ).toBeVisible()
}
test('restores a server guest across refresh and clears it on sign out', async ({
  page,
  context,
}) => {
  await guest(page, 'Guest Restore')
  const response = await page.request.get('/api/session')
  const before = await response.json()
  expect(before.user.player.id).toMatch(/^guest:/)
  const cookies = await context.cookies()
  expect(cookies.find((cookie) => cookie.name === 'lc_guest')?.httpOnly).toBe(
    true,
  )
  expect(await page.evaluate(() => document.cookie)).not.toContain('lc_guest')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Welcome, Guest Restore.' }),
  ).toBeVisible()
  expect(
    (await (await page.request.get('/api/session')).json()).user.player.id,
  ).toBe(before.user.player.id)
  await page.getByRole('button', { name: 'Leave Guest Session' }).click()
  await expect(
    page.getByRole('button', { name: 'Continue as Guest', exact: true }),
  ).toBeVisible()
  expect(
    (await (await page.request.get('/api/session')).json()).user,
  ).toBeNull()
})
test('default room form is four players, 100 points, and timed; invalid codes fail clearly', async ({
  page,
}) => {
  await guest(page, 'Settings Guest')
  await page.getByRole('button', { name: /Set the Table/ }).click()
  await expect(page.getByLabel('Number of players')).toHaveValue('4')
  await expect(page.getByLabel('Elimination cutoff')).toHaveValue('100')
  await expect(page.getByLabel('Timed game')).toBeChecked()
  await page.getByRole('button', { name: '← Back to Lounge' }).click()
  await page.getByRole('button', { name: /Take a Seat/ }).click()
  await page.getByLabel('Room code', { exact: true }).fill('ZZZZZZ')
  await page.getByRole('button', { name: 'Join Room', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/invalid|closed/)
  const unauthorized = await page.request.patch('/api/profile', {
    headers: { Origin: new URL(page.url()).origin },
    data: { displayName: 'Hacked' },
  })
  expect(unauthorized.status()).toBe(403)
})
test('two isolated guest browsers synchronize a lobby and host starts a private untimed game', async ({
  page,
  browser,
  baseURL,
}) => {
  const second = await browser.newContext({ baseURL })
  const other = await second.newPage()
  try {
    await guest(page, 'Host One')
    const code = await create(page, 2, false, 250)
    await expect(
      page.getByRole('button', { name: 'Start Game', exact: true }),
    ).toBeDisabled()
    await guest(other, 'Friend Two')
    await enter(other, code)
    await expect(
      page.getByText('2 connected · 2 of 2 seats reserved'),
    ).toBeVisible()
    await expect(
      other.getByText('Waiting for host to start', { exact: true }),
    ).toBeVisible()
    await expect(
      other.getByRole('button', { name: 'Start Game', exact: true }),
    ).toHaveCount(0)
    const denied = await other.request.post(`/api/rooms/${code}/start`, {
      headers: { Origin: baseURL! },
    })
    expect(denied.status()).toBe(403)
    const responses = await Promise.all([
      page.request.post(`/api/rooms/${code}/start`, {
        headers: { Origin: baseURL! },
      }),
      page.request.post(`/api/rooms/${code}/start`, {
        headers: { Origin: baseURL! },
      }),
    ])
    expect(responses.map((r) => r.status()).sort()).toEqual([200, 409])
    await expect(
      page.getByRole('heading', { name: 'Round 1', exact: true }),
    ).toBeVisible()
    await expect(
      other.getByRole('heading', { name: 'Round 1', exact: true }),
    ).toBeVisible()
    for (const [table, name, initials] of [[page, 'Host One', 'HO'], [other, 'Friend Two', 'FR']] as const) {
      await expect(table.locator('.hand-player')).toContainText(name)
      await expect(table.locator('.hand-player .profile-avatar')).toHaveText(initials)
      await expect(table.locator('.player-hand .card-value')).toHaveCount(0)
      // Both desktop and mobile now share the existing adaptive single-row hand.
      await expect(table.locator('.adaptive-hand')).toHaveAttribute('data-rows','1')
      await expect(table.locator('.joker-indicator')).toContainText('Round Joker')
    }
    const hostView = await (await page.request.get(`/api/rooms/${code}`)).json()
    const friendView = await (
      await other.request.get(`/api/rooms/${code}`)
    ).json()
    expect([7, 9]).toContain(hostView.game.hand.length)
    expect([7, 9]).toContain(friendView.game.hand.length)
    expect(hostView.game.deadline).toBeNull()
    expect(hostView.settings.eliminationThreshold).toBe(250)
    expect(hostView.game.players.every((p: object) => !('hand' in p))).toBe(
      true,
    )
    expect('drawPile' in hostView.game).toBe(false)
    expect(
      hostView.game.hand.some((card: { id: string }) =>
        friendView.game.hand.some(
          (other: { id: string }) => card.id === other.id,
        ),
      ),
    ).toBe(false)
    await other.reload()
    await expect(
      other.getByRole('heading', { name: 'Round 1', exact: true }),
    ).toBeVisible()
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/rooms/${code}`)).json()).members
            .length,
      )
      .toBe(2)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await other.emulateMedia({ reducedMotion: 'reduce' })
    const actor =
      hostView.game.currentPlayerId ===
      hostView.members.find(
        (m: { displayName: string }) => m.displayName === 'Host One',
      ).id
        ? page
        : other
    const viewer = await (await actor.request.get(`/api/rooms/${code}`)).json()
    const hand = viewer.game.hand
    const buttons = actor
      .getByRole('group', { name: 'Your hand', exact: true })
      .getByRole('button')
    const selectedIndex =
      viewer.game.phase === 'penalty'
        ? hand.findIndex((c: { rank: string }) => c.rank === '7')
        : 0
    await buttons.nth(selectedIndex).click()
    await actor
      .getByRole('button', {
        name: /^(Drop|Play)/,
      })
      .click()
    if (
      await actor
        .getByRole('button', { name: 'Draw New Card', exact: true })
        .isVisible()
    )
      await actor
        .getByRole('button', { name: 'Draw New Card', exact: true })
        .click()
    await expect
      .poll(
        async () =>
          (await (await actor.request.get(`/api/rooms/${code}`)).json()).game
            .latestDiscard[0].id,
      )
      .toBe(hand[selectedIndex].id)
    const hostEvents = (
      await (await page.request.get(`/api/rooms/${code}`)).json()
    ).game.events
    const friendEvents = (
      await (await other.request.get(`/api/rooms/${code}`)).json()
    ).game.events
    expect(hostEvents).toEqual(friendEvents)
    expect(hostEvents.length).toBeGreaterThan(1)
    expect(new Set(hostEvents.map((e: { id: string }) => e.id)).size).toBe(
      hostEvents.length,
    )
    await other.reload()
    await expect(
      other.getByRole('heading', { name: 'Round 1', exact: true }),
    ).toBeVisible()
    expect(
      (await (await other.request.get(`/api/rooms/${code}`)).json()).game
        .events,
    ).toEqual(hostEvents)
    await expect(
      page.locator('.live-opponent [role="img"]').first(),
    ).toHaveAttribute('aria-label', 'Face-down card')
  } finally {
    await second.close()
  }
})
test('invitations preserve a room through guest access and host departure transfers ownership', async ({
  page,
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({ baseURL })
  const friend = await ctx.newPage()
  try {
    await guest(page, 'Invite Host')
    const code = await create(page)
    await friend.goto(`/join/${code}`)
    await expect(
      friend.getByText(`Your invitation to room`, { exact: false }),
    ).toBeVisible()
    await friend
      .getByRole('button', { name: 'Continue as Guest', exact: true })
      .click()
    await friend
      .getByLabel('Display name', { exact: true })
      .fill('Invited Friend')
    await friend
      .getByRole('button', { name: 'Enter as guest', exact: true })
      .click()
    await expect(
      friend.getByRole('heading', { name: 'Waiting lobby' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Start Game', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Leave Room', exact: true }).click()
    await expect(
      friend.getByRole('button', { name: 'Start Game', exact: true }),
    ).toBeDisabled()
    await expect(
      friend.getByText('Guest · Host', { exact: true }),
    ).toBeVisible()
    expect(
      (await (await friend.request.get(`/api/rooms/${code}`)).json()).members,
    ).toHaveLength(1)
  } finally {
    await ctx.close()
  }
})
test('reconnects without a duplicate seat and rejects an extra player when full', async ({
  page,
  browser,
  baseURL,
}) => {
  const a = await browser.newContext({ baseURL })
  const b = await browser.newContext({ baseURL })
  try {
    const friend = await a.newPage()
    const extra = await b.newPage()
    await guest(page, 'Capacity Host')
    const code = await create(page)
    await guest(friend, 'Capacity Friend')
    await enter(friend, code)
    await friend.reload()
    await expect(
      friend.getByRole('heading', { name: 'Waiting lobby' }),
    ).toBeVisible()
    await expect(
      page.getByText('2 connected · 2 of 2 seats reserved'),
    ).toBeVisible()
    await guest(extra, 'Extra Guest')
    await extra.getByRole('button', { name: /Take a Seat/ }).click()
    await extra.getByLabel('Room code', { exact: true }).fill(code)
    await extra.getByRole('button', { name: 'Join Room', exact: true }).click()
    await expect(extra.getByRole('alert')).toContainText('full')
    expect(
      (await (await page.request.get(`/api/rooms/${code}`)).json()).members,
    ).toHaveLength(2)
  } finally {
    await a.close()
    await b.close()
  }
})
test('dashboard and lobby work at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await guest(page, 'Phone Guest')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await create(page, 8)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/least-count-lobby-mobile.png',
    fullPage: true,
  })
})

test('online discards commit and finish animating before the eligible pickup is enabled', async ({
  page,
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL })
  const friend = await context.newPage()
  try {
    await guest(page, 'Animation Host')
    const code = await create(page)
    await guest(friend, 'Animation Friend')
    await enter(friend, code)
    await page.getByRole('button', { name: 'Start Game', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Round 1', exact: true }),
    ).toBeVisible()
    const hostId = (await (await page.request.get('/api/session')).json()).user
      .player.id
    for (let attempt = 0; attempt < 6; attempt++) {
      const publicView = (
        await (await page.request.get(`/api/rooms/${code}`)).json()
      ).game
      const actor = publicView.currentPlayerId === hostId ? page : friend
      const current = (
        await (await actor.request.get(`/api/rooms/${code}`)).json()
      ).game
      if (current.phase === 'penalty') {
        await actor
          .getByRole('button', { name: /^Draw \d+ Penalty Cards$/ })
          .click()
        await expect
          .poll(
            async () =>
              (await (await actor.request.get(`/api/rooms/${code}`)).json())
                .game.currentPlayerId,
          )
          .not.toBe(current.currentPlayerId)
        continue
      }
      const index = current.hand.findIndex(
        (c: { rank: string }) =>
          c.rank !== '7' && c.rank !== current.latestDiscard.at(-1)?.rank,
      )
      expect(index).toBeGreaterThanOrEqual(0)
      await expect(
        actor.getByRole('button', { name: 'Draw New Card', exact: true }),
      ).toHaveCount(0)
      await actor
        .getByRole('group', { name: 'Your hand', exact: true })
        .getByRole('button')
        .nth(index)
        .click()
      if (!current.pickup.length) {
        await actor
          .getByRole('button', {
            name: 'Drop 1 Card',
            exact: true,
          })
          .click()
        await expect(actor.locator('.flight-incoming')).toHaveCount(1)
        await expect(actor.getByTestId('turn-animation')).toHaveCount(0)
        continue
      }
      const eligible = current.pickup[0]
      const animationClock = Date.now()
      await actor.clock.install({ time: new Date(animationClock) })
      await actor.clock.pauseAt(new Date(animationClock + 1000))
      await actor
        .getByRole('button', { name: 'Drop 1 Card', exact: true })
        .click()
      await expect(actor.locator('.flight-outgoing')).toHaveCount(1)
      await expect(actor.locator('.flight-incoming')).toHaveCount(0)
      const waiting = (
        await (await actor.request.get(`/api/rooms/${code}`)).json()
      ).game
      expect(waiting.phase).toBe('draw')
      expect(waiting.hand).toHaveLength(current.hand.length - 1)
      expect(waiting.pickup).toEqual(current.pickup)
      expect(waiting.deadline).toBe(current.deadline)
      await expect(
        actor.getByRole('button', { name: 'Draw New Card', exact: true }),
      ).toHaveCount(0)
      await actor.clock.runFor(650)
      await expect(actor.getByTestId('turn-animation')).toHaveCount(0)
      const pickup = actor.locator(`[data-pickup-card="${eligible.id}"]`)
      await pickup.click()
      await expect(actor.locator('.flight-incoming')).toHaveCount(1)
      await expect(actor.locator('.flight-outgoing')).toHaveCount(0)
      const done = (
        await (await actor.request.get(`/api/rooms/${code}`)).json()
      ).game
      expect(done.hand).toHaveLength(current.hand.length)
      expect(done.hand.some((c: { id: string }) => c.id === eligible.id)).toBe(
        true,
      )
      const peer = (
        await (
          await (actor === page ? friend : page).request.get(
            `/api/rooms/${code}`,
          )
        ).json()
      ).game
      expect(peer.events).toEqual(done.events)
      return
    }
    throw new Error('No manual pickup turn reached')
  } finally {
    await context.close()
  }
})
