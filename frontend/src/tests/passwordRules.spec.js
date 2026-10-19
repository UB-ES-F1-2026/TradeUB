import { describe, it, expect } from 'vitest'
import { getPasswordRules, isPasswordValid } from '../utils/passwordRules'

describe('passwordRules', () => {
  it('rebutja contrasenyes curtes', () => {
    expect(isPasswordValid('abc1')).toBe(false)
  })
  it('rebutja contrasenyes sense número', () => {
    expect(isPasswordValid('abcdefghij')).toBe(false)
  })
  it('accepta contrasenyes que compleixen tot', () => {
    expect(isPasswordValid('abcdefg1')).toBe(true)
  })
  it('retorna una regla per cada requisit', () => {
    expect(getPasswordRules('x')).toHaveLength(2)
  })
})