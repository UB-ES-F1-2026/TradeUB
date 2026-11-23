import { describe, it, expect } from 'vitest'
import {
  UNITS_FORMAT_ERROR,
  UNITS_REQUIRED_ERROR,
  buyQuote,
  commissionCents,
  parseUnits,
  unitsError,
} from '../utils/buy'

describe('parseUnits', () => {
  it('accepta enters positius, amb espais als extrems', () => {
    expect(parseUnits('3')).toBe(3)
    expect(parseUnits(' 12 ')).toBe(12)
  })

  it('rebutja decimals, zero, negatius i text', () => {
    for (const text of ['1,5', '1.5', '0', '-2', 'abc', '', null, undefined]) {
      expect(parseUnits(text)).toBeNull()
    }
  })

  it('rebutja nombres que no són enters segurs', () => {
    expect(parseUnits('99999999999999999999')).toBeNull()
  })
})

describe('unitsError', () => {
  it('demana les unitats si el camp és buit', () => {
    expect(unitsError('')).toBe(UNITS_REQUIRED_ERROR)
    expect(unitsError('   ')).toBe(UNITS_REQUIRED_ERROR)
  })

  it('avisa del format si no és un enter positiu', () => {
    expect(unitsError('1,5')).toBe(UNITS_FORMAT_ERROR)
    expect(unitsError('0')).toBe(UNITS_FORMAT_ERROR)
  })

  it('no retorna cap error amb unitats vàlides', () => {
    expect(unitsError('4')).toBe('')
  })
})

// Mateixa regla que buy_asset: least(ceil(cost) / 100, 1.00), amb el cost en euros
describe('commissionCents', () => {
  it("és l'1% del cost arrodonit a l'alça al cèntim", () => {
    expect(commissionCents(1000)).toBe(10) // 10 € -> 0,10 €
    expect(commissionCents(1050)).toBe(11) // 10,50 € -> 0,105 € -> 0,11 €
    expect(commissionCents(1)).toBe(1) // 0,01 € -> 0,0001 € -> 0,01 €
  })

  it('com a màxim és 1 €', () => {
    expect(commissionCents(10000)).toBe(100) // 100 € -> 1 € just
    expect(commissionCents(10001)).toBe(100)
    expect(commissionCents(500000)).toBe(100)
  })
})

describe('buyQuote', () => {
  it('calcula el cost, la comissió, el total i el saldo restant', () => {
    expect(buyQuote(3, 10.1, 100)).toEqual({
      cost: 30.3,
      commission: 0.31,
      total: 30.61,
      remaining: 69.39,
      enough: true,
      missing: null,
    })
  })

  it('accepta el preu i el saldo com a text (numeric de PostgREST)', () => {
    const quote = buyQuote(2, '150.25', '500.00')

    expect(quote.cost).toBe(300.5)
    expect(quote.commission).toBe(1)
    expect(quote.total).toBe(301.5)
    expect(quote.remaining).toBe(198.5)
  })

  it('amb el saldo just, hi ha prou i el restant és 0', () => {
    const quote = buyQuote(1, 10, 10.1)

    expect(quote.remaining).toBe(0)
    expect(quote.enough).toBe(true)
    expect(quote.missing).toBeNull()
  })

  it("sense saldo suficient diu quant falta", () => {
    const quote = buyQuote(1, 10, 5)

    expect(quote.enough).toBe(false)
    expect(quote.missing).toBe(5.1)
  })

  it('amb el saldo desconegut no bloqueja: ho decideix el backend', () => {
    const quote = buyQuote(1, 10)

    expect(quote.remaining).toBeNull()
    expect(quote.enough).toBe(true)
    expect(quote.missing).toBeNull()
  })
})
