import { describe, it, expect } from 'vitest'
import { UNITS_FORMAT_ERROR } from '../utils/buy'
import {
  SELL_INSUFFICIENT_UNITS_ERROR,
  SELL_UNITS_REQUIRED_ERROR,
  sellQuote,
  sellUnitsError,
} from '../utils/sell'

describe('sellUnitsError', () => {
  it('demana les unitats si el camp és buit', () => {
    expect(sellUnitsError('', 3)).toBe(SELL_UNITS_REQUIRED_ERROR)
    expect(sellUnitsError('  ', 3)).toBe(SELL_UNITS_REQUIRED_ERROR)
  })

  it('només admet unitats enteres positives', () => {
    for (const text of ['1,5', '0', '-2', 'abc']) {
      expect(sellUnitsError(text, 3)).toBe(UNITS_FORMAT_ERROR)
    }
  })

  it('no deixa vendre més unitats de les de la posició', () => {
    expect(sellUnitsError('4', 3)).toBe(SELL_INSUFFICIENT_UNITS_ERROR)
    expect(sellUnitsError('1', 0)).toBe(SELL_INSUFFICIENT_UNITS_ERROR)
  })

  it('accepta fins a totes les unitats de la posició', () => {
    expect(sellUnitsError('1', 3)).toBe('')
    expect(sellUnitsError('3', 3)).toBe('')
  })
})

describe('sellQuote', () => {
  it("descompta la comissió de l'1%, arrodonida a l'alça, de l'import", () => {
    expect(sellQuote(3, 10.1)).toEqual({ amount: 30.3, commission: 0.31, net: 29.99 })
  })

  it('la comissió és com a màxim 1 €', () => {
    expect(sellQuote(1, '212.40')).toEqual({ amount: 212.4, commission: 1, net: 211.4 })
  })

  it('calcula en cèntims, sense errors de coma flotant', () => {
    expect(sellQuote(3, '0.10')).toEqual({ amount: 0.3, commission: 0.01, net: 0.29 })
  })
})
