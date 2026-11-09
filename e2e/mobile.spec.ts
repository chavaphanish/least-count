import { expect, test } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'
import { createGame, latestGroup } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import { SESSION_KEY } from '../src/lib/session'

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const sizes = [{ width: 667, height: 375 }, { width: 844, height: 390 }, { width: 852, height: 393 }, { width: 932, height: 430 }]

function fixture() {
  for (let seed = 1; seed < 1000; seed++) {
    let value = seed
    const game = createGame(['You', 'Alex', 'Ben', 'Robin', 'Morgan', 'Jamie', 'Casey', 'Taylor'], Date.now(), () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0
      return value / 4294967296
    })
    if (game.current === 0 && game.phase === 'turn' && latestGroup(game)[0].rank !== '7') return game
  }
  throw new Error('No opening fixture found')
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), SESSION_KEY)
}
async function load(page: Page, game: GameState) {
  await page.clock.install({ time: new Date(game.deadline! - 60_000) })
  await page.clock.pauseAt(new Date(game.deadline! - 59_999))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/game')
  await page.evaluate(({key, game}) => sessionStorage.setItem(key, JSON.stringify(game)), {key: SESSION_KEY, game})
  await page.reload()
  await expect(page.getByRole('group', {name: 'Your hand', exact: true})).toBeVisible()
}
async function fullyVisible(locator: Locator) {
  await expect(locator).toBeInViewport({ratio: 1})
}

test.describe('landscape mobile presentation', () => {
  test.use({ userAgent: iphone, isMobile: true, hasTouch: true })
  for (const size of sizes) {
    test(`table, touch controls and rotation preserve state at ${size.width} × ${size.height}`, async ({page}) => {
      await page.setViewportSize(size)
      const game = fixture()
      await load(page, game)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      for (const selector of ['.live-table', '.opponent-row', '.hand-heading', '.live-piles', '.turn-panel', '.activity-heading', '.hand-heading .turn-clock']) {
        await fullyVisible(page.locator(selector))
      }
      await expect(page.locator('.live-opponent')).toHaveCount(7)
      for (const label of ['Draw pile', 'Drop Pile', 'Round Joker']) {
        await fullyVisible(page.locator('.live-piles .sample-pile').filter({hasText: label}).locator(':scope > span'))
      }
      const hands = page.locator('.hand-card')
      await expect(hands).toHaveCount(7)
      await fullyVisible(hands.last().locator('.playing-card'))
      const index = game.players[0].hand.findIndex(card => card.rank !== '7' && card.rank !== latestGroup(game)[0].rank)
      await hands.nth(index).tap()
      await expect(hands.nth(index)).toHaveAttribute('aria-pressed', 'true')
      const drop = page.getByRole('button', {name: 'Drop 1 Card', exact: true})
      await fullyVisible(drop)
      expect((await drop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      const before = await saved(page)
      await page.setViewportSize({width: size.height, height: size.width})
      const overlay = page.getByRole('dialog', {name: 'Rotate Your Phone'})
      await expect(overlay).toBeVisible()
      await expect(page.locator('.orientation-content')).toHaveAttribute('inert', '')
      await expect(overlay).toBeFocused()
      await page.keyboard.press('Enter')
      expect(await saved(page)).toEqual(before)
      await page.setViewportSize(size)
      await expect(overlay).toHaveCount(0)
      await expect(hands.nth(index)).toHaveAttribute('aria-pressed', 'true')
      expect(await saved(page)).toEqual(before)
      await drop.tap()
      await expect(page.getByRole('button', {name:'Draw New Card', exact:true})).toBeVisible()
      const waiting = await saved(page)
      expect(waiting.phase).toBe('draw')
      expect(waiting.deadline).toBe(before.deadline)
      const draw = page.getByRole('button', {name:'Draw New Card', exact:true})
      await fullyVisible(draw)
      await draw.tap()
      expect((await saved(page)).players[0].hand).toHaveLength(7)
      await fullyVisible(page.locator('.live-opponent.active-seat .turn-clock'))
      await fullyVisible(page.locator('.live-opponent.active-seat > span'))
      await expect(page.locator('.game-activity .latest-event:visible')).toContainText('You')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
      await page.screenshot({path: `/tmp/least-count-landscape-${size.width}.png`})
    })
  }
  test('large penalty hand stays accessible in its own scroll area', async ({page}) => {
    await page.setViewportSize(sizes[0])
    const game = fixture()
    game.players[0].hand.push(...game.drawPile.splice(0, 14))
    await load(page, game)
    await expect(page.locator('.hand-row')).toHaveCount(3)
    const last = page.locator('.hand-card').last()
    await last.scrollIntoViewIfNeeded()
    await fullyVisible(last.locator('.playing-card'))
    await last.tap()
    await expect(last).toHaveAttribute('aria-pressed', 'true')
    await fullyVisible(page.getByRole('button', {name: /^(Drop|Play)/}).first())
    await fullyVisible(page.locator('.activity-heading'))
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
  test('landscape cutout and home-indicator insets leave the hand and primary controls visible', async ({page}) => {
    await page.setViewportSize(sizes[0])
    await load(page, fixture())
    // CSS env values are device supplied; exercise both notch sides with equivalent insets.
    await page.locator('.app-shell').evaluate(el => {
      const shell = el as HTMLElement
      shell.style.setProperty('--mobile-safe-left', '44px')
      shell.style.setProperty('--mobile-safe-right', '44px')
      shell.style.setProperty('--mobile-safe-bottom', '21px')
    })
    await fullyVisible(page.locator('.hand-card').last().locator('.playing-card'))
    await fullyVisible(page.locator('.turn-actions .button').first())
    const shell = await page.locator('.live-table').boundingBox()
    expect(shell!.x).toBeGreaterThanOrEqual(44)
    expect(shell!.y + shell!.height).toBeLessThanOrEqual(375 - 21)
    await fullyVisible(page.locator('.activity-heading'))
  })
  test('opening in portrait blocks navigation and becomes usable on rotation', async ({page}) => {
    // Older Safari has no Screen Orientation API; the media query is sufficient.
    await page.addInitScript(() => Object.defineProperty(screen, 'orientation', {value: undefined}))
    await page.setViewportSize({width:390, height:844})
    await page.goto('/')
    await expect(page.getByRole('dialog', {name:'Rotate Your Phone'})).toBeVisible()
    await expect(page.locator('.orientation-content')).toHaveAttribute('inert', '')
    await page.setViewportSize(sizes[1])
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', {name:'Continue as Guest', exact:true})).toBeVisible()
    await page.getByRole('button', {name:'Continue as Guest', exact:true}).tap()
    await expect(page.getByLabel('Display name', {exact:true})).toBeVisible()
    expect(await page.getByLabel('Display name', {exact:true}).evaluate(el => getComputedStyle(el).fontSize)).toBe('16px')
  })
})

test('desktop portrait windows remain usable; iPadOS desktop UA receives the mobile guard', async ({page, browser, baseURL}) => {
  await page.setViewportSize({width:390, height:844})
  await page.goto('/#/rules')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', {name:'Know your table.'})).toBeVisible()
  const context = await browser.newContext({baseURL, userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', hasTouch:true, viewport:{width:768,height:1024}})
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', {get: () => 'MacIntel'})
      Object.defineProperty(navigator, 'maxTouchPoints', {get: () => 5})
    })
    const ipad = await context.newPage()
    await ipad.goto('/')
    await expect(ipad.getByRole('dialog', {name:'Rotate Your Phone'})).toBeVisible()
    await ipad.setViewportSize({width:1024,height:768})
    await expect(ipad.getByRole('dialog')).toHaveCount(0)
  } finally { await context.close() }
})

test('install metadata, icons and deep links are served by the production web build', async ({page, request}) => {
  await page.goto('/join/ABCDEF')
  const manifestURL = await page.locator('link[rel="manifest"]').getAttribute('href')
  const response = await request.get(manifestURL!)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('manifest')
  const manifest = await response.json()
  expect(manifest).toMatchObject({id:'/', name:'Least Count',short_name:'Least Count',display:'standalone',orientation:'landscape',scope:'/',start_url:'/'})
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).headers()['content-type']).toContain('image/png')
    const size = await page.evaluate(async src => {
      const image = new Image()
      image.src = src
      await image.decode()
      return `${image.naturalWidth}x${image.naturalHeight}`
    }, icon.src)
    expect(size).toBe(icon.sizes)
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  expect((await request.get(apple!)).ok()).toBe(true)
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content','yes')
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
  if (process.env.PLAYWRIGHT_PREVIEW === '1') {
    await page.evaluate(() => navigator.serviceWorker.ready)
    expect(await page.evaluate(async () => (await caches.keys()).length)).toBe(0)
  }
  expect((await request.get('/auth/callback?flow=recovery')).ok()).toBe(true)
})

test('real multiplayer retains its socket, selection and deadline through rotation; server timeout continues in portrait', async ({browser, baseURL}) => {
  test.setTimeout(95_000)
  const options = {baseURL, userAgent:iphone, isMobile:true, hasTouch:true, viewport:sizes[1]}
  const hostContext = await browser.newContext(options)
  const friendContext = await browser.newContext(options)
  const host = await hostContext.newPage()
  const friend = await friendContext.newPage()
  let sockets = 0
  for (const page of [host, friend]) page.on('websocket', () => sockets++)
  const guest = async (page: Page, name: string) => {
    await page.goto('/')
    await page.getByRole('button', {name:'Continue as Guest', exact:true}).tap()
    await page.getByLabel('Display name', {exact:true}).fill(name)
    await page.getByRole('button', {name:'Enter as guest', exact:true}).tap()
    await expect(page.getByRole('heading', {name:`Welcome, ${name}.`})).toBeVisible()
  }
  try {
    await guest(host, 'Rotate Host')
    await host.getByRole('button', {name:/Create Game Room/}).tap()
    await host.getByLabel('Number of players').selectOption('2')
    await host.getByRole('button', {name:'Create Room', exact:true}).tap()
    await expect(host.getByRole('heading', {name:'Waiting lobby'})).toBeVisible()
    const code = (await host.locator('.room-code-panel strong').textContent())!
    await guest(friend, 'Rotate Friend')
    await friend.getByRole('button', {name:/Join Game Room/}).tap()
    await friend.getByLabel('Room code', {exact:true}).fill(code)
    await friend.getByRole('button', {name:'Join Room', exact:true}).tap()
    await expect(host.getByRole('button', {name:'Start Game', exact:true})).toBeEnabled()
    await host.getByRole('button', {name:'Start Game', exact:true}).tap()
    await expect(host.locator('.live-table')).toBeVisible()
    for (const page of [host, friend]) {
      for (const selector of ['.live-table', '.opponent-row', '.hand-heading', '.live-piles', '.turn-panel', '.activity-heading']) await fullyVisible(page.locator(selector))
      await fullyVisible(page.locator('.hand-card').last().locator('.playing-card'))
      await page.getByText('Room options', {exact:true}).tap()
      await expect(page.getByRole('button', {name:'Copy Code', exact:true})).toBeVisible()
      await page.getByText('Room options', {exact:true}).tap()
    }
    const view = async (page: Page) => (await (await page.request.get(`/api/rooms/${code}`)).json())
    const initial = await view(host)
    const hostId = (await (await host.request.get('/api/session')).json()).user.player.id
    const actor = initial.game.currentPlayerId === hostId ? host : friend
    await expect(actor.locator('.connection-live')).toBeVisible()
    const before = await view(actor)
    const socketCount = sockets
    const card = actor.locator('.hand-card:not(:disabled)').first()
    await card.tap()
    await expect(card).toHaveAttribute('aria-pressed','true')
    await actor.setViewportSize({width:390,height:844})
    await expect(actor.getByRole('dialog', {name:'Rotate Your Phone'})).toBeVisible()
    expect((await view(actor)).game).toEqual(before.game)
    await actor.setViewportSize(sizes[1])
    await expect(actor.getByRole('dialog')).toHaveCount(0)
    await expect(card).toHaveAttribute('aria-pressed','true')
    expect((await view(actor)).game).toEqual(before.game)
    expect(sockets).toBe(socketCount)
    await actor.setViewportSize({width:390,height:844})
    await expect(actor.getByRole('dialog')).toBeVisible()
    await expect.poll(async () => (await view(actor)).game.phase, {timeout:75_000, intervals:[1000]}).toBe('game-over')
    const after = await view(actor)
    expect(after.game.players.find((p: {id:string}) => p.id === before.game.currentPlayerId).eliminated).toBe(true)
    expect(after.game.events.some((e: {type:string; reason?:string}) => e.type === 'PLAYER_ELIMINATED' && e.reason === 'timeout')).toBe(true)
    expect(new Set(after.game.events.map((e: {id:string}) => e.id)).size).toBe(after.game.events.length)
    expect(sockets).toBe(socketCount)
    await expect(actor.getByRole('dialog')).toBeVisible()
    await actor.setViewportSize(sizes[1])
    await expect(actor.getByRole('dialog')).toHaveCount(0)
    await expect(actor.locator('.round-summary')).toContainText('wins the match!')
  } finally {
    await hostContext.close()
    await friendContext.close()
  }
})
