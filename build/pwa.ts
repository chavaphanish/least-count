import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/** Build-time versioning only; no precache, provider keys or user data in the worker. */
export function pwa(): Plugin {
  return {
    name: 'least-count-network-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const version = createHash('sha256').update(Object.keys(bundle).sort().join('\n')).digest('hex').slice(0, 16)
      const source = readFileSync(new URL('../src/pwa/service-worker.js', import.meta.url), 'utf8')
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: source.replace('__BUILD_VERSION__', version) })
    },
  }
}
