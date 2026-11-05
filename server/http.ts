export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED',
  ) {
    super(message)
  }
}
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
export function failure(reason: unknown) {
  if (reason instanceof ApiError)
    return json({ error: reason.message, code: reason.code }, reason.status)
  return json(
    {
      error: 'The service could not complete this request. Please retry.',
      code: 'SERVICE_ERROR',
    },
    500,
  )
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  const bytes = await readBytes(request, 16_384)
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error()
    return value as Record<string, unknown>
  } catch {
    throw new ApiError(400, 'Send a valid JSON object.')
  }
}
export async function readBytes(
  request: Request,
  limit: number,
): Promise<Uint8Array> {
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.length
      if (length > limit) {
        await reader.cancel()
        throw new ApiError(413, 'The request is too large.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
export function requireOrigin(request: Request, appOrigin?: string) {
  if (
    request.headers.get('Origin') !== new URL(request.url).origin &&
    (!appOrigin ||
      !appOrigin.split(',').includes(request.headers.get('Origin') ?? ''))
  )
    throw new ApiError(403, 'This request must come from the game website.')
}
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('')
}
export function cookie(request: Request) {
  return (
    request.headers
      .get('Cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('lc_guest='))
      ?.slice(9) ?? ''
  )
}
export function guestCookie(request: Request, token: string, maxAge = 604800) {
  return `lc_guest=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
