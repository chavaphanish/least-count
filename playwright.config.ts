import { defineConfig } from '@playwright/test'

const preview = process.env.PLAYWRIGHT_PREVIEW === '1'
const port = preview ? 4173 : 5173
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL,
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run ${preview ? 'preview' : 'dev'} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
