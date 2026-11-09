import { chromium, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page, BrowserContext } from '@playwright/test'
import { createGame, latestGroup } from '../src/game/engine'
import type { GameState } from '../src/game/engine'
import { createCard } from '../src/game/cards'
import { cardValue } from '../src/game/deck'
import type { RoomView } from '../src/shared/multiplayer'
import { SESSION_KEY } from '../src/lib/session'

const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const sizes = [{width:800,height:360},{width:851,height:393},{width:915,height:412},{width:960,height:432}]
function fixture() {
  for (let seed = 1; seed < 1000; seed++) {
    let value = seed
    const game = createGame(['You','Alex','Ben','Robin'], Date.now(), () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0
      return value / 4294967296
    })
    if (game.current === 0 && game.phase === 'turn' && latestGroup(game)[0].rank !== '7') return game
  }
  throw new Error('No matching fixture')
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), SESSION_KEY)
}
async function load(page: Page, game = fixture()) {
  await page.clock.install({time:new Date(game.deadline! - 60_000)})
  await page.clock.pauseAt(new Date(game.deadline! - 59_999))
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/#/game')
  await page.evaluate(({key,game}) => sessionStorage.setItem(key,JSON.stringify(game)), {key:SESSION_KEY,game})
  await page.reload()
  await expect(page.locator('.player-hand')).toBeVisible()
}
async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test.describe('Android landscape', () => {
  test.use({userAgent:android,isMobile:true,hasTouch:true})
  for (const size of sizes) test(`touch play, portrait guard and eligible Declare Least at ${size.width} × ${size.height}`, async ({page}) => {
    await page.setViewportSize(size)
    const game = fixture()
    await load(page, game)
    for (const selector of ['.live-table','.live-piles','.hand-heading','.opponent-row','.turn-panel','.activity-heading','.hand-heading .turn-clock']) await expect(page.locator(selector)).toBeInViewport({ratio:1})
    await expect(page.locator('.hand-card').last().locator('.playing-card')).toBeInViewport({ratio:1})
    const index = game.players[0].hand.findIndex(c => c.rank !== '7' && c.rank !== latestGroup(game)[0].rank)
    const card = page.locator('.hand-card').nth(index)
    await card.tap()
    const before = await saved(page)
    await page.setViewportSize({width:size.height,height:size.width})
    await expect(page.getByRole('dialog', {name:'Rotate Your Phone'})).toBeVisible()
    await expect(page.locator('.orientation-content')).toHaveAttribute('inert','')
    await page.setViewportSize(size)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await saved(page)).toEqual(before)
    await expect(card).toHaveAttribute('aria-pressed','true')
    const drop = page.getByRole('button', {name:'Drop 1 Card',exact:true})
    await expect(drop).toBeInViewport({ratio:1})
    expect((await drop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await drop.tap()
    const draw = page.getByRole('button', {name:'Draw New Card',exact:true})
    await expect(draw).toBeInViewport({ratio:1})
    await draw.tap()
    expect((await saved(page)).players[0].hand).toHaveLength(7)
    await expect(page.locator('.game-activity .latest-event:visible')).toContainText('You')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
    await page.screenshot({path:`/tmp/least-count-android-${size.width}.png`})
    const low = fixture()
    low.players[0].hand = [{...createCard('clubs','A'),id:'android-ace'}]
    await page.evaluate(({key,game}) => sessionStorage.setItem(key,JSON.stringify(game)), {key:SESSION_KEY,game:low})
    await page.reload()
    const declare = page.getByRole('button', {name:'Declare Least',exact:true})
    await expect(declare).toBeInViewport({ratio:1})
    await declare.tap()
    await expect(page.locator('.round-summary')).toBeVisible()
  })
})

test('Chrome installability checks accept the manifest, maskable icon and active service worker', async ({baseURL}) => {
  test.skip(process.env.PLAYWRIGHT_PREVIEW !== '1', 'Service workers are registered only in production builds')
  // Ordinary Playwright contexts are incognito, where Chrome intentionally blocks installation.
  const profile = await mkdtemp(join(tmpdir(),'least-count-install-'))
  const context = await chromium.launchPersistentContext(profile, {baseURL,headless:true,userAgent:android,isMobile:true,hasTouch:true,viewport:sizes[0],executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
  try {
    const page = await context.newPage()
    await page.goto('/')
    await controlled(page)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Page.enable')
    const manifest = await cdp.send('Page.getAppManifest')
    expect(manifest.errors).toEqual([])
    expect(manifest.url).toContain('/manifest.webmanifest')
    expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([])
    const data = JSON.parse(manifest.data!)
    expect(data).toMatchObject({name:'Least Count',short_name:'Least Count',display:'standalone',orientation:'landscape',scope:'/',start_url:'/'})
    expect(data.icons.some((i: {purpose:string}) => i.purpose.includes('maskable'))).toBe(true)
    expect(await page.evaluate(() => caches.keys())).toEqual([])
  } finally {
    await context.close()
    await rm(profile,{recursive:true,force:true})
  }
})

test('offline navigation shows connection guidance without caching a session or an app shell', async ({page, context}) => {
  test.skip(process.env.PLAYWRIGHT_PREVIEW !== '1', 'Requires production worker')
  await page.goto('/')
  await controlled(page)
  await context.setOffline(true)
  await expect(page.locator('.pwa-status')).toContainText('Online games need a connection')
  const response = await page.goto('/join/ABCDEF')
  expect(response!.status()).toBe(503)
  await expect(page.getByRole('heading', {name:'Connection required'})).toBeVisible()
  expect(await page.evaluate(() => caches.keys())).toEqual([])
  await context.setOffline(false)
  await page.getByRole('link', {name:'Try again'}).click()
  await expect(page.getByRole('button', {name:'Continue as Guest',exact:true})).toBeVisible()
})

test('worker updates wait safely during play and reload only the tab that accepts outside a table', async ({page, context}) => {
  test.skip(process.env.PLAYWRIGHT_PREVIEW !== '1', 'Requires production worker')
  let revision = 1
  await context.route('**/sw.js', async route => {
    const response = await route.fetch()
    await route.fulfill({response,body:`${await response.text()}\n// test deployment ${revision}\n`})
  })
  // Complete first installation before freezing the gameplay clock. Lifecycle
  // scheduling in the service-worker process is independent of game timers.
  await page.goto('/')
  await controlled(page)
  await load(page)
  await controlled(page)
  const before = await saved(page)
  const other = await context.newPage()
  await other.goto('/')
  await controlled(other)
  await load(other)
  await controlled(other)
  const otherBefore = await saved(other)
  let otherReloads = 0
  other.on('framenavigated', frame => { if (frame === other.mainFrame()) otherReloads++ })
  revision++
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
  await expect(page.getByRole('button', {name:'Update and reload'})).toHaveCount(0)
  expect(await saved(page)).toEqual(before)
  await page.getByRole('link', {name:'Dashboard',exact:true}).click()
  await expect(page.getByRole('button', {name:'Update and reload'})).toBeVisible()
  await Promise.all([page.waitForEvent('load'),page.getByRole('button', {name:'Update and reload'}).click()])
  await expect(page.getByRole('button', {name:'Update and reload'})).toHaveCount(0)
  expect(await saved(page)).toEqual(before)
  expect(await saved(other)).toEqual(otherBefore)
  expect(otherReloads).toBe(0)
})

async function guest(page: Page, name: string) {
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/')
  await page.getByRole('button', {name:'Continue as Guest',exact:true}).click()
  await page.getByLabel('Display name', {exact:true}).fill(name)
  await page.getByRole('button', {name:'Enter as guest',exact:true}).click()
  await expect(page.getByRole('heading', {name:`Welcome, ${name}.`})).toBeVisible()
}

test('Android, iPhone and desktop share rounds, activity and authoritative resume without replaying actions', async ({browser, baseURL}) => {
  test.setTimeout(120_000)
  const contexts: BrowserContext[] = []
  try {
    for (const userAgent of [android,iphone,undefined]) contexts.push(await browser.newContext({baseURL,userAgent,viewport:sizes[1],isMobile:!!userAgent,hasTouch:!!userAgent}))
    const pages = await Promise.all(contexts.map(c => c.newPage()))
    for (const [i,p] of pages.entries()) await guest(p, ['Android','iPhone','Desktop'][i])
    const host = pages[0]
    await host.getByRole('button', {name:/Create Game Room/}).click()
    await host.getByLabel('Number of players').selectOption('3')
    await host.getByRole('button', {name:'Create Room',exact:true}).click()
    await expect(host.getByRole('heading', {name:'Waiting lobby'})).toBeVisible()
    const code = (await host.locator('.room-code-panel strong').textContent())!
    for (const p of pages.slice(1)) {
      await p.getByRole('button', {name:/Join Game Room/}).click()
      await p.getByLabel('Room code', {exact:true}).fill(code)
      await p.getByRole('button', {name:'Join Room',exact:true}).click()
      await expect(p.getByRole('heading', {name:'Waiting lobby'})).toBeVisible()
    }
    await host.getByRole('button', {name:'Start Game',exact:true}).click()
    for (const p of pages) await expect(p.locator('.live-table')).toBeVisible()
    const view = async (p: Page): Promise<RoomView> => (await (await p.request.get(`/api/rooms/${code}`)).json())
    const ids = await Promise.all(pages.map(async p => (await (await p.request.get('/api/session')).json()).user.player.id as string))
    const initial = await view(host)
    let transientFailure = true
    await host.route(`**/api/rooms/${code}/join`, route => {
      if (transientFailure) {
        transientFailure = false
        return route.fulfill({status:503,json:{error:'Temporary network transition'}})
      }
      return route.continue()
    })
    await contexts[0].setOffline(true)
    await expect(host.locator('.pwa-status')).toContainText('offline')
    await contexts[0].setOffline(false)
    await expect(host.locator('.connection-live')).toBeVisible({timeout:15_000})
    expect(transientFailure).toBe(false)
    const restored = await view(host)
    expect(restored.game).toEqual(initial.game)
    expect(restored.members).toHaveLength(3)
    // Simulate an OS visibility lifecycle separately from a viewport rotation.
    const beforeResume = await view(host)
    let sockets = 0
    host.on('websocket', () => sockets++)
    await host.evaluate(() => {
      Object.defineProperty(document,'hidden',{configurable:true,value:true})
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document,'hidden',{configurable:true,value:false})
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => sockets).toBe(1)
    await expect(host.locator('.connection-live')).toBeVisible()
    expect((await view(host)).game).toEqual(beforeResume.game)
    const beforeRotation = sockets
    await host.setViewportSize({width:393,height:851})
    await expect(host.getByRole('dialog')).toBeVisible()
    await host.setViewportSize(sizes[1])
    await expect(host.getByRole('dialog')).toHaveCount(0)
    expect(sockets).toBe(beforeRotation)
    let dropped = false
    let drew = false
    let seven = false
    let declared = false
    for (let step = 0; step < 250; step++) {
      const common = (await view(host)).game!
      if (common.phase === 'round-over') break
      const actor = pages[ids.indexOf(common.currentPlayerId)]
      const actorBefore = await view(actor)
      const g = actorBefore.game!
      if (g.canShow) {
        await actor.getByRole('button', {name:'Declare Least',exact:true}).click()
        declared = true
      } else if (g.phase === 'draw') {
        await actor.getByRole('button', {name:'Draw New Card',exact:true}).click()
        drew = true
      } else {
        const ranks = [...new Set(g.hand.map(c => c.rank))]
        const rank = g.phase === 'penalty' || ranks.includes('7') ? '7' : ranks.sort((a,b) => {
          const value = (r: typeof a) => g.hand.filter(c => c.rank === r).reduce((n,c) => n + 15 + cardValue(c,g.indicator.rank),0)
          return value(b) - value(a)
        })[0]
        for (const card of g.hand.filter(c => c.rank === rank)) await actor.locator(`[data-hand-card="${card.id}"]`).click()
        await actor.locator('[data-plan-discard]').click()
        dropped = true
        seven ||= rank === '7'
      }
      await expect.poll(async () => (await view(actor)).revision).toBeGreaterThan(actorBefore.revision)
      // Public activity is the shared protocol across all three browser profiles.
      const events = (await view(actor)).game!.events
      for (const peer of pages) await expect.poll(async () => (await view(peer)).game!.events).toEqual(events)
      if (declared) break
    }
    expect(dropped).toBe(true)
    expect(drew).toBe(true)
    expect(declared).toBe(true)
    expect((await view(host)).game!.phase).toBe('round-over')
    if (seven) expect((await view(host)).game!.events.some(e => e.type === 'POWER_SEVEN_PLAYED')).toBe(true)
    await host.getByRole('button', {name:'Start round 2',exact:true}).click()
    for (const peer of pages) await expect.poll(async () => (await view(peer)).game!.round).toBe(2)
  } finally { await Promise.all(contexts.map(c => c.close())) }
})
