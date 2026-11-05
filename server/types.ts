import type { PublicPlayer } from '../src/shared/multiplayer'
export interface Env {
  ASSETS: Fetcher
  DIRECTORY: DurableObjectNamespace
  ROOMS: DurableObjectNamespace
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  APP_ORIGIN?: string
}
export type Identity = PublicPlayer & { expiresAt: number }
