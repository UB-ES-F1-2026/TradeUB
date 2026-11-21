import { describe, it, expect } from 'vitest'
import { assetTypeLabel, assetsSearchPath } from '../utils/assets'

describe('assetsSearchPath', () => {
  it('sense text o amb menys de 2 caràcters demana tot el catàleg', () => {
    expect(assetsSearchPath('')).toBe('/assets')
    expect(assetsSearchPath('   ')).toBe('/assets')
    expect(assetsSearchPath(' a ')).toBe('/assets')
  })

  it('a partir de 2 caràcters envia el text net i codificat', () => {
    expect(assetsSearchPath(' ap ')).toBe('/assets?q=ap')
    expect(assetsSearchPath('Johnson & Johnson')).toBe('/assets?q=Johnson%20%26%20Johnson')
  })
})

describe('assetTypeLabel', () => {
  it('tradueix els tipus del catàleg', () => {
    expect(assetTypeLabel('accio')).toBe('Acció')
    expect(assetTypeLabel('etf')).toBe('ETF')
  })

  it('deixa igual un tipus desconegut', () => {
    expect(assetTypeLabel('bo')).toBe('bo')
  })
})
