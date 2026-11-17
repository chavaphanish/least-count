import { expect, test } from '@playwright/test'
import { mock } from './career-fixture'
import type { Locator } from '@playwright/test'
const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const appearance = (button: Locator) =>
  button.evaluate(async (el) => {
    await Promise.all(
      el.getAnimations().map((animation) => animation.finished.catch(() => {})),
    )
    const s = getComputedStyle(el)
    return [
      s.backgroundColor,
      s.color,
      s.borderColor,
      s.borderWidth,
      s.borderRadius,
      s.padding,
      s.fontSize,
      s.fontWeight,
      s.minHeight,
      s.outlineStyle,
      s.outlineWidth,
      s.outlineOffset,
      s.opacity,
      s.transform,
      s.boxShadow,
    ]
  })
for (const viewport of [
  { width: 667, height: 375 },
  { width: 915, height: 412 },
  { width: 1280, height: 800 },
]) {
  test.describe(`Lounge group ${viewport.width}`, () => {
    test.use({ viewport, userAgent: iphone, isMobile: true, hasTouch: true })
    test('Lounge action states and navigation remain usable', async ({
      page,
    }) => {
      await mock(page)
      await page.goto('/')
      const group = page.getByRole('group', { name: 'Game options' }),
        buttons = group.getByRole('button', { name: 'Join Game Room', exact: true })
      await expect(buttons).toHaveText([
        'Join Game Room',
      ])
      await expect(group).toBeVisible()
      const base = await appearance(buttons.first())
      expect(await buttons.first().locator('.lounge-action-icon').evaluate(el=>getComputedStyle(el).color)).toBe(
        await page.locator('html').evaluate((el) => {
          const probe = document.createElement('span')
          probe.style.color = getComputedStyle(el).getPropertyValue('--gold')
          el.append(probe)
          const color = getComputedStyle(probe).color
          probe.remove()
          return color
        }),
      )
      const hovered: string[][] = [],
        pressed: string[][] = [],
        focused: string[][] = [],
        disabled: string[][] = []
      for (const button of await buttons.all()) {
        expect(await appearance(button)).toEqual(base)
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        await button.hover()
        await expect
          .poll(async () => (await appearance(button))[0])
          .not.toBe(base[0])
        hovered.push(await appearance(button))
        await page.mouse.down()
        await expect
          .poll(async () => (await appearance(button))[13])
          .toBe('matrix(1, 0, 0, 1, 0, 1)')
        pressed.push(await appearance(button))
        await page.mouse.move(0, 0)
        await page.mouse.up()
        await page.keyboard.press('Tab')
        await button.focus()
        await expect(button).toHaveCSS('outline-width', '3px')
        focused.push((await appearance(button)).slice(0, 13))
        await button.evaluate((el) => {
          el.setAttribute('aria-disabled', 'true')
          if (el instanceof HTMLButtonElement) el.disabled = true
        })
        disabled.push(await appearance(button))
        await button.evaluate((el) => {
          el.removeAttribute('aria-disabled')
          if (el instanceof HTMLButtonElement) el.disabled = false
          ;(el as HTMLElement).blur()
        })
      }
      for (const states of [hovered, pressed, focused, disabled])
        for (const style of states) expect(style).toEqual(states[0])
      await page.getByRole('link', { name: 'Your profile', exact: true }).click()
      await expect(
        page.getByRole('region', { name: 'Player career' }),
      ).toBeVisible()
      await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      for (const [name, target] of [
        ['Leaderboards', '.leaderboard'],
        ['Buddies', '.circle-panel'],
      ]) {
        await page.getByRole('link', { name, exact: true }).click()
        await expect(page.locator(target)).toBeVisible()
        await page.getByRole('link', { name: 'Lounge', exact: true }).click()
      }
      expect(
        await page.locator('.dashboard-action.lounge-nav-button').count(),
      ).toBe(0)
      expect(
        await page.evaluate(() => [
          document.documentElement.scrollWidth,
          document.documentElement.scrollHeight,
        ]),
      ).toEqual([viewport.width, viewport.height])
    })
  })
}
test('desktop retains profile navigation', async ({
  page,
}) => {
  await mock(page)
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Game options' })).toBeVisible()
  const profile = page.getByRole('link', { name: 'Your profile', exact: true })
  await expect(profile).toHaveClass(/brand header-profile/)
  await expect(page.getByRole('link', { name: 'Leaderboards', exact: true })).toBeVisible()
  await profile.click()
  await expect(
    page.getByRole('region', { name: 'Player career' }),
  ).toBeVisible()
})
