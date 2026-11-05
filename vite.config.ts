import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  preview: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
})
