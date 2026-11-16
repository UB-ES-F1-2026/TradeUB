import { describe, it, expect } from 'vitest'
import {
  depositError,
  parseAmount,
  DEPOSIT_FORMAT_ERROR,
  DEPOSIT_MAX_ERROR,
  DEPOSIT_MIN_ERROR,
  DEPOSIT_REQUIRED_ERROR,
} from '../utils/deposit'

describe('parseAmount', () => {
  it('accepta imports enters i amb coma o punt decimal', () => {
    expect(parseAmount('50')).toBe('50')
    expect(parseAmount('50,5')).toBe('50.5')
    expect(parseAmount('50.25')).toBe('50.25')
    expect(parseAmount(' 50,25 ')).toBe('50.25')
  })

  it('rebutja més de dos decimals, separadors de milers i text', () => {
    expect(parseAmount('50,123')).toBeNull()
    expect(parseAmount('1.234,50')).toBeNull()
    expect(parseAmount('50€')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('depositError', () => {
  it("demana l'import si el camp és buit", () => {
    expect(depositError('')).toBe(DEPOSIT_REQUIRED_ERROR)
    expect(depositError('   ')).toBe(DEPOSIT_REQUIRED_ERROR)
  })

  it('rebutja un format no vàlid', () => {
    expect(depositError('10,999')).toBe(DEPOSIT_FORMAT_ERROR)
  })

  it("rebutja imports inferiors a 1 € amb l'error literal", () => {
    expect(depositError('0,99')).toBe("L'import mínim d'ingrés és d'1 €.")
    expect(depositError('0')).toBe(DEPOSIT_MIN_ERROR)
  })

  it("rebutja imports superiors a 10.000 € amb l'error literal", () => {
    expect(depositError('10000,01')).toBe("L'import màxim per operació és de 10.000 €.")
    expect(depositError('20000')).toBe(DEPOSIT_MAX_ERROR)
  })

  it('accepta els límits exactes', () => {
    expect(depositError('1')).toBe('')
    expect(depositError('10000')).toBe('')
    expect(depositError('10000,00')).toBe('')
  })
})
