import type { CapacitorConfig } from '@capacitor/cli'

// Development placeholder only. Select the store bundle/application ID later.
const appId = process.env.CAPACITOR_APP_ID?.trim() || 'com.example.leastcount'
if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*){2,}$/.test(appId)) {
  throw new Error('CAPACITOR_APP_ID must be a reverse-domain ID, e.g. com.example.leastcount.')
}

const config: CapacitorConfig = {
  appId,
  appName: 'YAYDU',
  webDir: 'dist',
}

export default config
