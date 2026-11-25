import { expect, test, type Page } from '@playwright/test'
import { mock } from './career-fixture'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
async function circle(page: Page) {
  const state = await mock(page)
  const friends = Array.from({ length: 14 }, (_, i) => ({
    ...state.friend, id: `${(i + 3).toString().padStart(8, '0')}-1111-4111-8111-111111111111`,
    username: `friend${i.toString().padStart(2, '0')}`, firstName: i === 0 ? 'ExtraordinarilyLongFirstName' : `Friend ${i}`,
    lastName: 'LongFamilyName', relationship: 'accepted', gamesTogether: i * 2,
  }))
  const fresh = { ...state.friend, id: '33333333-3333-4333-8333-333333333333', username: 'newfriend', relationship: 'none' }
  const pending = { ...state.friend, id: '44444444-4444-4444-8444-444444444444', username: 'sentfriend', relationship: 'outgoing' }
  const incoming = { ...state.friend, id: '55555555-5555-4555-8555-555555555555', username: 'incomingfriend', relationship: 'incoming' }
  let newOnline = false, failSearch = false, failAction = false
  const actions: string[] = []
  const calls: { ids: string[]; heartbeat: boolean }[] = []
  await page.route('**/api/presence', route => {
    const input = route.request().postDataJSON(); calls.push(input)
    return route.fulfill({ json: { online: Object.fromEntries(input.ids.filter((id: string) => id === friends[13].id || (newOnline && id === friends[0].id)).map((id: string) => [id, 60000])) } })
  })
  await page.route('**/api/career**', async (route, request) => {
    const url = new URL(request.url()), op = url.searchParams.get('op')
    if (request.method() === 'POST') {
      if (failAction) return route.fulfill({ status: 503, json: { error: 'Please retry your request.' } })
      const { id, action } = request.postDataJSON(); actions.push(action)
      const player = [fresh, pending, incoming].find(p => p.id === id)!
      player.relationship = action === 'request' ? 'outgoing' : action === 'accept' ? 'accepted' : 'none'
      return route.fulfill({ json: { relationship: player.relationship } })
    }
    if (op === 'buddies') return route.fulfill({ json: { players: [...friends, fresh, pending, incoming].filter(p => p.relationship !== 'none'), blocked: [] } })
    if (op === 'search') {
      expect(url.searchParams.get('scope')).toBe('circle')
      if (failSearch) return route.fulfill({ status: 503, json: { error: 'Search temporarily unavailable.' } })
      return route.fulfill({ json: [fresh, pending, incoming, friends[0], { ...state.me, relationship: 'none' }] })
    }
    return route.fallback()
  })
  return { friends, calls, actions, online: () => { newOnline = true }, failSearch: (value: boolean) => { failSearch = value }, failAction: (value: boolean) => { failAction = value } }
}
for (const [width, height] of [[1280, 800], [844, 390], [667, 375], [568, 320], [480, 320]]) {
  test(`Your Circle fits ${width}x${height} with compact scrollable lists and four left tabs`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, ...(width < 1000 ? { isMobile: true, hasTouch: true, userAgent: iphone } : {}) })
    try {
      const page = await context.newPage(), state = await circle(page)
      await page.goto('/#/buddies')
      const panel = page.getByRole('region', { name: 'Buddies', exact: true })
      await expect(panel.getByRole('button', { name: 'All Friends', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(panel.getByRole('button', { name: /Back to Lounge/ })).toHaveCount(0)
      await expect(panel.getByRole('heading', { name: 'Your Circle' })).toHaveCount(0)
      const list = panel.getByRole('list', { name: 'All Friends', exact: true })
      await expect(list.locator('li')).toHaveCount(14)
      await expect(list.locator('li').first()).toContainText('@friend13')
      await expect(list.locator('li').first().locator('.presence-dot')).toBeVisible()
      await expect(list.locator('li').first()).toContainText(/Level \d/)
      expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
      const frame = (await list.boundingBox())!
      const firstRow = (await list.locator('li').first().boundingBox())!
      const lastTab = (await panel.getByRole('button', {name:'Friend Requests'}).boundingBox())!
      expect(Math.abs(firstRow.height * 5 - frame.height)).toBeLessThan(1)
      expect(Math.abs(lastTab.y + lastTab.height - frame.y - frame.height)).toBeLessThan(1)
      for (const tab of ['Favourites', 'Currently Online', 'Friend Requests', 'All Friends']) {
        await panel.getByRole('button', { name: tab, exact: true }).click()
        if (tab === 'Favourites') {
          await expect(panel.getByRole('list', { name: tab, exact: true }).locator('li')).toHaveCount(10)
          await expect(panel.getByRole('list', { name: tab, exact: true }).locator('li').first()).toContainText('26 games together')
        }
        if (tab === 'Currently Online') await expect(panel.getByRole('list', { name: tab, exact: true }).locator('li')).toHaveCount(1)
        if (tab === 'Friend Requests') {
          await panel.getByLabel('Username', { exact: true }).fill('FrIeNd')
          await panel.getByRole('button', { name: 'Search', exact: true }).click()
          await expect(panel.getByRole('button', { name: 'Add Friend', exact: true })).toBeVisible()
          await expect(panel.getByRole('button', { name: 'Request Sent', exact: true })).toBeDisabled()
          await expect(panel.getByRole('button', { name: 'Friends', exact: true })).toBeDisabled()
          await expect(panel.getByRole('list', { name: 'Search results', exact: true }).locator('li')).toHaveCount(4)
          await panel.getByRole('list', { name: 'Incoming friend requests', exact: true }).getByRole('button', { name: 'Accept', exact: true }).click()
          await expect(panel.locator('.circle-message')).toHaveText('Friend request accepted.')
        }
        const geometry = await panel.evaluate(el => {
          const buttons = [...el.querySelectorAll('.career-tabs button')].map(b => b.getBoundingClientRect())
          const controls = [...el.querySelectorAll('.career-tabs button,.circle-search input,.circle-search button')].map(b => b.getBoundingClientRect())
          const content = el.querySelector('.circle-results')!.getBoundingClientRect()
          return { vertical: buttons.every(b => b.x === buttons[0].x) && buttons[3].bottom < innerHeight,
            left: buttons[0].right < content.left,
            fits: controls.every(r => r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight),
            noPageScroll: document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth,
            noListHorizontalScroll: [...el.querySelectorAll('.circle-list')].every(list => list.scrollWidth <= list.clientWidth) }
        })
        expect(geometry).toEqual({ vertical: true, left: true, fits: true, noPageScroll: true, noListHorizontalScroll: true })
      }
      const first = list.locator('li').first().getByRole('link')
      await first.click()
      await expect(page).toHaveURL(new RegExp(`#/player/${state.friends[13].username}$`))
      await expect(page.getByRole('heading', { name: /^Other Player @lc_other$/ })).toBeVisible()
    } finally { await context.close() }
  })
}
test('friend request actions handle status, errors, duplicates, acceptance and decline', async ({ page }) => {
  const state = await circle(page)
  await page.goto('/#/buddies')
  const panel = page.getByRole('region', { name: 'Buddies', exact: true })
  await panel.getByRole('button', { name: 'Friend Requests', exact: true }).click()
  await panel.getByLabel('Username', { exact: true }).fill('friend')
  state.failSearch(true)
  await panel.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('Search temporarily unavailable.')
  state.failSearch(false)
  await panel.getByRole('button', { name: 'Retry', exact: true }).click()
  const results = panel.getByRole('list', { name: 'Search results', exact: true })
  state.failAction(true)
  await results.getByRole('button', { name: 'Add Friend', exact: true }).click()
  await expect(results.getByRole('alert')).toContainText('Please retry')
  state.failAction(false)
  await results.getByRole('button', { name: 'Add Friend', exact: true }).click()
  await expect(panel.locator('.circle-message')).toHaveText('Friend request sent.')
  await expect(results.getByRole('button', { name: 'Request Sent', exact: true })).toHaveCount(2)
  await expect(results.getByRole('button', { name: 'Add Friend', exact: true })).toHaveCount(0)
  await panel.getByRole('list', { name: 'Incoming friend requests', exact: true }).getByRole('button', { name: 'Decline', exact: true }).click()
  await expect(panel.locator('.circle-message')).toHaveText('Friend request declined.')
  await expect(panel.getByText('No incoming friend requests.', { exact: true })).toBeVisible()
  await results.getByRole('button', { name: 'Add Friend', exact: true }).click()
  expect(state.actions).toEqual(['request', 'decline', 'request'])
})
test('online-only tab discovers previously offline unmounted friends through the shared scheduler', async ({ page }) => {
  const state = await circle(page)
  await page.clock.install()
  await page.goto('/#/buddies')
  await page.getByRole('button', { name: 'Currently Online', exact: true }).click()
  const list = page.getByRole('list', { name: 'Currently Online', exact: true })
  await expect(list.locator('li')).toHaveCount(1)
  const beats = state.calls.filter(c => c.heartbeat).length
  state.online(); await page.clock.fastForward(30000)
  await expect(list.locator('li')).toHaveCount(2)
  expect(state.calls.filter(c => c.heartbeat).length).toBe(beats + 1)
  await expect(list.locator('li').first()).toContainText('@friend00')
})
