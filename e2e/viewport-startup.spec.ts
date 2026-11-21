import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' })

test('standalone first rotation recovers delayed viewport dimensions without a second event or remount', async ({ page }) => {
  await mock(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true })
    const sizes = { width: 390, height: 844 }
    Object.assign(window, { testVisualSize: sizes })
    Object.defineProperty(visualViewport!, 'width', { get: () => sizes.width })
    Object.defineProperty(visualViewport!, 'height', { get: () => sizes.height })
  })
  await page.clock.install()
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Rotate Your Phone' })).toBeVisible()
  const main = await page.locator('main').elementHandle()
  await page.setViewportSize({ width: 844, height: 390 })
  // The visual viewport initially still has portrait dimensions.
  await page.evaluate(() => dispatchEvent(new Event('orientationchange')))
  const shell = page.locator('.mobile-shell')
  await expect(shell).toHaveCSS('--app-width', '844px')
  await expect(shell).toHaveCSS('--app-height', '390px')
  await page.evaluate(() => {
    const sizes = (window as unknown as { testVisualSize: { width: number; height: number } }).testVisualSize
    sizes.width = 844; sizes.height = 360
    visualViewport!.dispatchEvent(new Event('resize'))
    // Simulate Safari stabilizing silently after the last resize event.
    setTimeout(() => { sizes.height = 390 }, 400)
  })
  await page.clock.runFor(1600)
  await expect(shell).toHaveCSS('--app-height', '390px')
  await expect(page.getByRole('dialog', { name: 'Rotate Your Phone' })).not.toBeVisible()
  expect(await main!.evaluate(node => node === document.querySelector('main'))).toBe(true)
  await page.clock.runFor(4000)
  const bounds = await page.locator('.app-shell').boundingBox()
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 844, height: 390 })
  expect(await page.evaluate(() => [scrollX, scrollY, document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([0, 0, 844, 390])

  // Returning from the home screen/bfcache can also settle without a resize event.
  await page.evaluate(() => {
    const sizes = (window as unknown as { testVisualSize: { height: number } }).testVisualSize
    sizes.height = 350
    dispatchEvent(new Event('pageshow'))
    setTimeout(() => { sizes.height = 390 }, 400)
  })
  await page.clock.runFor(1600)
  await expect(shell).toHaveCSS('--app-height', '390px')
  expect(await main!.evaluate(node => node === document.querySelector('main'))).toBe(true)
})

test('visual keyboard resize and recovery keep the shared viewport current', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await mock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Game Room', exact: true }).click()
  await page.getByLabel('Elimination cutoff').fill('150')
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, 'height', { configurable: true, get: () => 170 })
    visualViewport!.dispatchEvent(new Event('resize'))
  })
  const shell = page.locator('.mobile-shell')
  await expect(shell).toHaveAttribute('data-keyboard', 'true')
  await expect(shell).toHaveCSS('--app-height', '170px')
  await expect(page.getByLabel('Elimination cutoff')).toHaveValue('150')
  await page.evaluate(() => {
    delete (visualViewport as unknown as { height?: number }).height
    visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect(shell).not.toHaveAttribute('data-keyboard', 'true')
  await expect(shell).toHaveCSS('--app-height', '390px')
  await expect(page.getByLabel('Elimination cutoff')).toHaveValue('150')
})


test('first landscape rotation follows visual viewport origin through late scroll-only updates', async ({ page }) => {
  await mock(page)
  await page.addInitScript(() => {
    const origin = { left: 0, top: 0, height: 844 }
    Object.assign(window, { testVisualOrigin: origin })
    Object.defineProperty(visualViewport!, 'offsetLeft', { get: () => origin.left })
    Object.defineProperty(visualViewport!, 'offsetTop', { get: () => origin.top })
    Object.defineProperty(visualViewport!, 'height', { get: () => origin.height })
  })
  await page.clock.install()
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Rotate Your Phone' })).toBeVisible()
  const main = await page.locator('main').elementHandle()
  await page.setViewportSize({ width: 844, height: 390 })
  await page.evaluate(() => {
    const origin = (window as unknown as { testVisualOrigin: { top: number; height: number } }).testVisualOrigin
    origin.top = 24; origin.height = 366
    visualViewport!.dispatchEvent(new Event('scroll'))
  })
  const shell = page.locator('.app-shell'), loading = page.locator('.startup-screen')
  await expect.poll(() => shell.boundingBox()).toMatchObject({ x: 0, y: 24, width: 844, height: 366 })
  await expect.poll(() => loading.boundingBox()).toMatchObject({ x: 0, y: 24, width: 844, height: 366 })
  await page.clock.runFor(5500)
  await expect(loading).toHaveCount(0)
  // Offset-only changes must update even though viewport width and height are unchanged.
  await page.evaluate(() => {
    const origin = (window as unknown as { testVisualOrigin: { top: number } }).testVisualOrigin
    origin.top = 12
    visualViewport!.dispatchEvent(new Event('scroll'))
    setTimeout(() => { origin.top = 0 }, 400)
  })
  await page.clock.runFor(1600)
  await expect.poll(() => shell.boundingBox()).toMatchObject({ x: 0, y: 0, width: 844, height: 366 })
  expect(await main!.evaluate(node => node === document.querySelector('main'))).toBe(true)
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0])
  // The layout viewport can itself lag: do not clamp a valid visible height to it.
  await page.evaluate(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 366 })
    const origin = (window as unknown as { testVisualOrigin: { height: number } }).testVisualOrigin
    origin.height = 390
    visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect.poll(() => shell.boundingBox()).toMatchObject({ x: 0, y: 0, width: 844, height: 390 })
})
