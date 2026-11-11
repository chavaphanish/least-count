import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionUser } from '../shared/multiplayer'
export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = 'NETWORK_ERROR',
  ) {
    super(message)
  }
}
export type RuntimeConfig = {
  supabase: { url: string; publishableKey: string } | null
  service: string
}
export class Services {
  provider: SupabaseClient | null = null
  private providerUrl = ''
  configure(config: RuntimeConfig) {
    if (
      config.supabase &&
      this.provider &&
      this.providerUrl === config.supabase.url
    )
      return
    this.providerUrl = config.supabase?.url ?? ''
    this.provider = config.supabase
      ? createClient(config.supabase.url, config.supabase.publishableKey, {
          global: { fetch: (input, init) => {
            const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
            // The SDK still owns PKCE, verification and session storage. Only signup
            // transport passes through the Worker for final validation/race checks.
            if(url.origin===config.supabase!.url && url.pathname==='/auth/v1/signup' && init?.method==='POST')
              return fetch('/api/auth/register',{...init,headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:init.signal??AbortSignal.timeout(25000)})
            return fetch(input,init)
          }},
          auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null
  }
  async api<T>(
    path: string,
    options: RequestInit = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const headers = new Headers(options.headers)
    if (this.provider && path !== '/config' && path !== '/guest') {
      const { data, error } = await this.provider.auth.getSession()
      if (error)
        throw new ServiceError(
          'Your sign-in session could not be restored. Please sign in again.',
          401,
        )
      if (data.session)
        headers.set('Authorization', `Bearer ${data.session.access_token}`)
    }
    if (options.body && typeof options.body === 'string')
      headers.set('Content-Type', 'application/json')
    let response: Response
    try {
      response = await fetch(`/api${path}`, {
        ...options,
        headers,
        credentials: 'same-origin',
        signal: signal ?? AbortSignal.timeout(12_000),
      })
    } catch {
      throw new ServiceError(
        'The game service could not be reached. Check your connection and retry.',
      )
    }
    let result: unknown
    try {
      result = await response.json()
    } catch {
      throw new ServiceError(
        'The game backend is unavailable. Start the Worker service or check deployment settings.',
        503,
      )
    }
    if (!response.ok) {
      const error = result as { error?: string; code?: string }
      throw new ServiceError(
        error.error ?? 'The request failed.',
        response.status,
        error.code,
      )
    }
    return result as T
  }
  session(signal?: AbortSignal) {
    return this.api<{
      user: SessionUser | null
      room: { id: string; code: string } | null
    }>('/session', {}, signal)
  }
}
export type StartupAdapter = {
  config: (signal: AbortSignal) => Promise<RuntimeConfig>
  configure: (config: RuntimeConfig) => void
  restore: () => Promise<unknown>
  session: (signal: AbortSignal) => ReturnType<Services['session']>
}
export async function initialize(
  adapter: StartupAdapter,
  stage: (step: number, message: string) => void,
  signal: AbortSignal,
) {
  stage(0, 'Connecting to game services…')
  const config = await adapter.config(signal)
  if (signal.aborted)
    throw new ServiceError(
      'Initialization timed out. Retry when your connection is ready.',
    )
  stage(1, 'Initializing account services…')
  adapter.configure(config)
  stage(2, 'Checking your session…')
  await adapter.restore()
  if (signal.aborted)
    throw new ServiceError('Initialization timed out. Please retry.')
  stage(3, 'Preparing your profile…')
  const session = await adapter.session(signal)
  stage(4, 'Ready to play!')
  return { config, ...session }
}
