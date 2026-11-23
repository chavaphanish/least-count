import type { Fetcher, DurableObjectNamespace } from '@cloudflare/workers-types'
import type { PublicPlayer } from '../src/shared/multiplayer'
export interface Env {
  ASSETS: Fetcher
  DIRECTORY: DurableObjectNamespace
  ROOMS: DurableObjectNamespace
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ACCOUNT_ADMIN_KEY?: string
  ACCOUNT_DELETION_CF_ACCOUNT_ID?: string
  ACCOUNT_DELETION_CF_TOKEN?: string
  ACCOUNT_DELETION_WORKER_NAME?: string
  SUPABASE_CAREER_KEY?: string
  CAREER_ENABLED?: string
  CAREER_ORIGIN?: string
  APP_ORIGIN?: string
  GUEST_STATS_TOKEN?: string
  GUEST_IP_DAYS?: string
  GUEST_DEVICE_DAYS?: string
  GUEST_HISTORY_DAYS?: string
  GUEST_MULTIPLAYER_ENABLED?: string
}
export type Identity = PublicPlayer & { expiresAt: number }
