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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
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
