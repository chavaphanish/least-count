import { describe, it, expect } from 'vitest'
import {
  username,
  usernameError,
  personalName,
  passwordError,
  validEmail,
  registrationEmail,
} from './identity'
describe('registration validation', () => {
  it('accepts ASCII alphanumeric usernames at both boundaries and canonicalizes case', () => {
    expect(username('AbCd1234')).toBe('abcd1234')
    expect(username('A'.repeat(24))).toHaveLength(24)
  })
  it.each([
    'abc1234',
    'a'.repeat(25),
    'player_name',
    'my player',
    'player@123',
    'éclair123',
    ' user1234',
  ])('rejects invalid username %j', (value) => {
    expect(() => username(value)).toThrow()
    expect(usernameError(value)).not.toBe('')
  })
  it('trims personal names independently and preserves international letters and punctuation', () => {
    expect(personalName('  李 Anne-Marie  ')).toBe('李 Anne-Marie')
    expect(personalName('José O’Neill')).toBe('José O’Neill')
  })
  it.each(['', '   ', 'a'.repeat(81), 'Bad\nName'])(
    'rejects invalid personal name %j',
    (name) => expect(() => personalName(name)).toThrow(),
  )
  it('validates email without Gmail-style rewriting', () => {
    expect(validEmail(' Person+tag@example.com ')).toBe(true)
    expect(registrationEmail(' Person+tag@EXAMPLE.COM ')).toBe(
      'person+tag@example.com',
    )
    expect(validEmail('not-an-email')).toBe(false)
  })
  it('accepts spaces and passphrases without imposing composition rules', () => {
    expect(passwordError('eight888')).toBe('')
    expect(passwordError(' a long passphrase ')).toBe('')
    expect(passwordError('short')).not.toBe('')
    expect(passwordError('        ')).not.toBe('')
  })
})
