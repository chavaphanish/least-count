import { expect, test } from '@playwright/test'
import type { Page, WebSocketRoute } from '@playwright/test'
import { createRoom, join, start, sweep, gameAction, view, reconcileHost } from '../server/room'
import type { RoomRecord } from '../server/room'
import { createCard } from '../src/game/cards'
import { png } from './career-fixture'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
function setupRoom() {
  const now = Date.now(), names = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']
  const people = names.map((name, i) => ({ id: `user:00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, displayName: `Player ${name}`, username: `player000${i + 1}`, firstName: 'Player', lastName: name, avatarUrl: '/host-player.png', accountType: 'registered' as const, expiresAt: now + 3600000 }))
  const room = createRoom('host-room', 'ABC234', people[0], { maxPlayers: 8, timedGame: true, eliminationThreshold: 100 }, now)
  people.slice(1).forEach(p => join(room, p, now))
  room.members.forEach(m => { m.connected = true; m.lastSeen = now; m.disconnectedAt = null })
  start(room, people[0].id, now, () => .6)
  const g = room.game!
  g.phase = 'turn'; g.sevens = null; g.current = 0; g.deadline = now - 1
  g.discards = [[{ ...createCard('clubs', '4'), id: 'old-four' }]]; g.eligible = []
  g.players[1].hand = [{ ...createCard('hearts', '4'), id: 'new-four' }, { ...createCard('hearts', '5'), id: 'remaining-five' }]
  sweep(room, now)
  expect(room.hostTransfer).toBeTruthy()
  return room
}
async function connect(page: Page, room: RoomRecord, index: number, sockets: {id:string;socket:WebSocketRoute}[]) {
  const player = room.members[index]
  await page.route('**/api/config', route => route.fulfill({ json: { supabase: null, service: 'least-count' } }))
  await page.route('**/api/session', route => route.fulfill({ json: { user: { player, email: null, createdAt: '2026-01-01', lastActiveAt: '2026-01-01' }, room: { id: room.id, code: room.code } } }))
  await page.route('**/host-player.png', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/rooms/ABC234/join', route => route.fulfill({ json: view(room, player.id, Date.now()) }))
  await page.route('**/api/rooms/ABC234/ticket', route => route.fulfill({ json: { ticket: 'test' } }))
  await page.routeWebSocket('**/api/rooms/ABC234/ws**', socket => {
    sockets.push({ id: player.id, socket })
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw))
      if (message.type === 'ping') { socket.send(JSON.stringify({ type: 'pong', serverNow: Date.now() })); return }
      try {
        gameAction(room, player.id, message.action, Date.now()); room.revision++
        publish(room, sockets)
        socket.send(JSON.stringify({ type: 'ack', requestId: message.requestId }))
      } catch (error) { socket.send(JSON.stringify({ type: 'error', requestId: message.requestId, message: (error as Error).message })) }
    })
  })
  await page.goto('/#/room/ABC234')
  await expect(page.getByText('Connected', { exact: true }).first()).toBeVisible()
}
function publish(room: RoomRecord, sockets: {id:string;socket:WebSocketRoute}[]) {
  for (const { id, socket } of sockets) socket.send(JSON.stringify({ type: 'state', room: view(room, id, Date.now()) }))
}
for (const [width, height] of [[1280, 800], [844, 390], [667, 375], [568, 320]]) test.describe(`Host selection ${width}x${height}`, () => {
  test.use({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: iphone } : {}) })
  test('seven candidates fit, one can be selected, and transfer preserves game state', async ({ page }) => {
    const room = setupRoom(), sockets: {id:string;socket:WebSocketRoute}[] = []
    await connect(page, room, 0, sockets)
    const dialog = page.getByRole('dialog', { name: 'Transfer Host Role' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('You have been eliminated. Please select a player to take over as host.')
    await expect(dialog.getByRole('radio')).toHaveCount(7)
    await expect(dialog.locator('img')).toHaveCount(7)
    const confirm = dialog.getByRole('button', { name: 'Transfer Host', exact: true })
    await expect(confirm).toBeDisabled()
    const size = await dialog.evaluate(el => {
      const r = el.getBoundingClientRect()
      return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, scroll:el.scrollHeight, height:el.clientHeight, controls:[...el.querySelectorAll('label,button')].map(n=>{const b=n.getBoundingClientRect();return{top:b.top,bottom:b.bottom,left:b.left,right:b.right}}) }
    })
    expect(size.top).toBeGreaterThanOrEqual(0); expect(size.bottom).toBeLessThanOrEqual(height); expect(size.left).toBeGreaterThanOrEqual(0); expect(size.right).toBeLessThanOrEqual(width)
    expect(size.scroll).toBeLessThanOrEqual(size.height)
    for (const control of size.controls) { expect(control.top).toBeGreaterThanOrEqual(size.top); expect(control.bottom).toBeLessThanOrEqual(size.bottom); expect(control.left).toBeGreaterThanOrEqual(size.left); expect(control.right).toBeLessThanOrEqual(size.right) }
    await expect(dialog.locator('.identity-primary').first()).toHaveCSS('transform', 'none')
    if (width === 667 || width === 568) await page.screenshot({ path: `/tmp/yaydu-host-transfer-${width}.png` })
    await dialog.getByText('@player0003', { exact: true }).click()
    await expect(dialog.getByRole('radio').nth(1)).toBeChecked()
    room.members[2].connected = false; publish(room, sockets)
    await expect(dialog.getByRole('radio').nth(1)).toBeDisabled(); await expect(confirm).toBeDisabled()
    await dialog.getByText('@player0002', { exact: true }).click()
    await expect(dialog.getByRole('radio').nth(0)).toBeChecked()
    const game = structuredClone(room.game), order = room.members.map(m=>m.id)
    await confirm.click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Player Two is now the host.' })).toBeVisible()
    expect(room.hostId).toBe(room.members[1].id); expect(room.game).toEqual(game); expect(room.members.map(m=>m.id)).toEqual(order)
    expect(room.members[0].left).toBe(false); expect(room.game!.players[0].eliminated).toBe(true)
  })
})
test('other clients continue playing while the host chooses and receive new privileges in real time', async ({ page, browser }) => {
  const room = setupRoom(), sockets: {id:string;socket:WebSocketRoute}[] = []
  const peer = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  try {
    await connect(page, room, 0, sockets); await connect(peer, room, 1, sockets)
    await expect(page.getByRole('dialog', { name: 'Transfer Host Role' })).toBeVisible()
    await expect(peer.getByRole('dialog', { name: 'Transfer Host Role' })).toHaveCount(0)
    const transferId = room.hostTransfer!.id
    await peer.getByRole('group', { name: 'Your hand' }).getByRole('button', { name: /^4 of/ }).click()
    await peer.getByRole('button', { name: 'Drop 1 Card', exact: true }).click()
    await expect.poll(()=>room.game!.current).toBe(2)
    expect(room.hostTransfer!.id).toBe(transferId)
    await page.getByRole('dialog', { name: 'Transfer Host Role' }).getByText('@player0002', { exact: true }).click()
    await page.getByRole('button', { name: 'Transfer Host', exact: true }).click()
    await expect(peer.getByRole('status').filter({ hasText: 'Player Two is now the host.' })).toBeVisible()
    room.game!.players[2].hand = [{ ...createCard('clubs', 'A'), id: 'low-hand' }]
    room.game!.players.slice(1).forEach((p,i) => { if (i !== 1) p.hand = [{ ...createCard('clubs', 'K'), id: `high-hand-${i}` }] })
    gameAction(room, room.members[2].id, { type: 'show' }, Date.now()); publish(room, sockets)
    await expect(peer.getByRole('button', { name: 'Start round 2', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start round 2', exact: true })).toHaveCount(0)
    await peer.getByRole('button', { name: 'Start round 2', exact: true }).click()
    await expect.poll(()=>room.game!.round).toBe(2)
  } finally { await peer.close() }
})


test('automatic reassignment closes the eliminated host popup and announces the new host', async ({ page }) => {
  const room = setupRoom(), sockets: {id:string;socket:WebSocketRoute}[] = []
  await connect(page, room, 0, sockets)
  await expect(page.getByRole('dialog', { name: 'Transfer Host Role' })).toBeVisible()
  const game = structuredClone(room.game)
  room.hostTransfer!.deadline = Date.now() - 1
  reconcileHost(room, Date.now()); publish(room, sockets)
  await expect(page.getByRole('dialog', { name: 'Transfer Host Role' })).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Player Two is now the host.' })).toBeVisible()
  expect(room.game).toEqual(game)
})
