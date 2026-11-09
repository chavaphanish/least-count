import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { pwa } from './build/pwa'

export default defineConfig({
  plugins: [react(), pwa()],
  build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  preview: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
})
