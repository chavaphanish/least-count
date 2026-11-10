import type { Page } from '@playwright/test'
/** Normal career navigation has no outer selector; editing/account views expose it. */
export async function profileView(page: Page, value: string) {
  const select = page.getByRole('combobox', { name: 'Profile views' })
  if (!(await select.isVisible())) {
    const edit = page.getByRole('link', { name: 'Edit Profile', exact: true })
    if (!(await edit.isVisible()))
      await page.getByRole('button', { name: 'Overview', exact: true }).click()
    await edit.click()
  }
  await select.selectOption(value)
}
