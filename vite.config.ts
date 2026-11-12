import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { pwa } from './build/pwa'

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version as string

export default defineConfig({
  plugins: [react(), pwa()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  preview: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
})
