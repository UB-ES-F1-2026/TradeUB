import { describe, it, expect } from 'vitest'
import {
  ALL_ASSET_TYPES,
  assetTypeLabel,
  assetsSearchPath,
  dailyChangeTrend,
  formatClosePrice,
  formatDailyChange,
  filterAssetsByType,
  formatPriceDate,
} from '../utils/assets'

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

describe('formatDailyChange', () => {
  // Intl posa un espai no separable abans del %
  const format = (pct) => formatDailyChange(pct).replace(/\s/g, ' ')

  it('mostra el signe i dos decimals en format català', () => {
    expect(format(0.85)).toBe('+0,85 %')
    expect(format(-1.08)).toBe('−1,08 %')
    expect(format(0)).toBe('0,00 %')
  })

  it('accepta la variació com a text', () => {
    expect(format('2.47')).toBe('+2,47 %')
  })

  it('sense dada mostra "No disponible"', () => {
    expect(formatDailyChange(null)).toBe('No disponible')
  })
})

describe('formatClosePrice', () => {
  it('mostra el preu en euros amb dos decimals', () => {
    expect(formatClosePrice(212.4).replace(/\s/g, ' ')).toBe('212,40 €')
    expect(formatClosePrice('4.31').replace(/\s/g, ' ')).toBe('4,31 €')
  })

  it('sense dada mostra "No disponible"', () => {
    expect(formatClosePrice(null)).toBe('No disponible')
  })
})

describe('formatPriceDate', () => {
  it('mostra la data com a dia/mes/any', () => {
    expect(formatPriceDate('2026-11-13')).toBe('13/11/2026')
  })

  it('sense dada mostra "No disponible"', () => {
    expect(formatPriceDate(null)).toBe('No disponible')
  })
})

describe('dailyChangeTrend', () => {
  it('diu si la variació puja, baixa o no canvia', () => {
    expect(dailyChangeTrend(0.85)).toBe('up')
    expect(dailyChangeTrend(-0.01)).toBe('down')
    expect(dailyChangeTrend(0)).toBe('flat')
    expect(dailyChangeTrend('0.00')).toBe('flat')
    expect(dailyChangeTrend(null)).toBe('flat')
  })
})

// US5.2: el filtre per tipus es combina amb la cerca, que ja ha fet el backend
describe('filterAssetsByType', () => {
  const ASSETS = [
    { ticker: 'AAPL', type: 'accio' },
    { ticker: 'IWDA', type: 'etf' },
    { ticker: 'BTC', type: 'cripto' },
    { ticker: 'TEF', type: 'accio' },
  ]

  it("\"Tots\" no filtra i manté l'ordre", () => {
    expect(filterAssetsByType(ASSETS, ALL_ASSET_TYPES)).toEqual(ASSETS)
  })

  it('deixa només els actius del tipus triat, en el mateix ordre', () => {
    expect(filterAssetsByType(ASSETS, 'accio').map((a) => a.ticker)).toEqual(['AAPL', 'TEF'])
    expect(filterAssetsByType(ASSETS, 'etf').map((a) => a.ticker)).toEqual(['IWDA'])
    expect(filterAssetsByType(ASSETS, 'cripto').map((a) => a.ticker)).toEqual(['BTC'])
  })

  it('sense cap actiu del tipus retorna una llista buida', () => {
    expect(filterAssetsByType([ASSETS[0]], 'etf')).toEqual([])
  })
})
