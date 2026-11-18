import type { Page } from '@playwright/test'
/** Local gameplay fixtures still need a server-confirmed session, like the live app. */
export async function mockLocalSession(page: Page) {
  await page.route('**/api/config', route => route.fulfill({ json: { service: 'least-count', supabase: null } }))
  await page.route('**/api/session', route => route.fulfill({ json: { user: {
    player: { id: 'guest:local-test', displayName: 'Local Tester', accountType: 'guest', avatarUrl: null },
    email: null, createdAt: '2026-11-18T00:00:00Z', lastActiveAt: '2026-11-18T00:00:00Z',
  }, room: null } }))
}
