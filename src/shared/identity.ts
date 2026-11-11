export function usernameError(value: string): string {
  if (!/^[A-Za-z0-9]*$/.test(value)) return 'Only letters and numbers allowed.'
  if (value.length < 8) return 'Username too short. Use at least 8 characters.'
  if (value.length > 24) return 'Use no more than 24 characters.'
  return ''
}
export function username(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a username.')
  const error = usernameError(value)
  if (error) throw new Error(error)
  return value.toLowerCase()
}
export function personalName(value: unknown): string {
  if (typeof value !== 'string' || /\p{Cc}/u.test(value))
    throw new Error('Enter a name without control characters.')
  const name = value.normalize('NFC').trim()
  if (!name || [...name].length > 80)
    throw new Error('Use 1–80 characters for each name.')
  return name
}
export function validEmail(value: string): boolean {
  const email = value.trim()
  // HTML's established email-address grammar (WHATWG/MDN), shared with the Worker.
  // Supabase remains authoritative and verifies ownership before account access.
  return email.length <= 254 && email.split('@')[0].length <= 64 &&
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email) &&
    !email.startsWith('.') && !email.includes('..') && !email.includes('.@')
}
// Supabase treats email addresses case-insensitively; do not strip dots or plus tags.
export const registrationEmail = (value: string) => value.trim().toLowerCase()
export function passwordError(value: string): string {
  if (!value.trim()) return 'Enter a password that is not only whitespace.'
  if ([...value].length < 8)
    return 'Use at least 8 characters for your password.'
  if ([...value].length > 128)
    return 'Use no more than 128 characters for your password.'
  return ''
}
export type PrivateProfile = {
  username: string
  firstName: string
  lastName: string
  needsCompletion: boolean
}

/** New registrations only. Legacy profile/login identifiers keep their existing limits. */
export function registrationUsername(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 20)
    throw new Error('Username must contain between 8 and 20 characters.')
  if (!/^[A-Za-z0-9]+$/.test(value))
    throw new Error('Username can contain only letters and numbers.')
  return value.toLowerCase()
}
export function registrationName(value: unknown, label = 'Name'): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  const name = value.trim()
  if (!/^[A-Za-z]+$/.test(name)) throw new Error(`${label} may contain only English letters, without spaces or punctuation.`)
  if (name.length > 80) throw new Error(`${label} must contain no more than 80 letters.`)
  return name
}
