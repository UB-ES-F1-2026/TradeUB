import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet } from '../services/api'
import ActiusView from '../views/ActiusView.vue'

// El cercador i les targetes tenen els seus propis tests (assetSearch, buyCard i sellCard.spec.js)
async function mountActius() {
  const wrapper = mount(ActiusView, {
    global: { stubs: { AssetSearch: true, BuyCard: true, SellCard: true } },
  })
  await flushPromises()
  return wrapper
}

const APPLE = { id: 7, name: 'Apple Inc.', ticker: 'AAPL', type: 'accio', close_price_eur: '10.10' }

// Usuari verificat amb 3 unitats d'Apple
function mockVerifiedUser() {
  apiGet.mockImplementation(async (path) => {
    if (path === '/users/me') return { verificacio: { estat: 'verificat', termes_acceptats: true } }
    if (path === '/account/positions') return [{ asset_id: 7, units: 3 }]
    return null
  })
}

describe('ActiusView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('mostra el cercador', async () => {
    const wrapper = await mountActius()

    expect(wrapper.get('h1').text()).toBe('Actius')
    expect(wrapper.findComponent({ name: 'AssetSearch' }).exists()).toBe(true)
  })

  // Technical Debt 4: la insígnia surt de la targeta del cercador i va a la dreta de la capçalera
  it('indica a la capçalera que els preus són simulats', async () => {
    const wrapper = await mountActius()

    expect(wrapper.get('.ui-page__actions [data-test="simulated-prices"]').text()).toBe('Preus simulats')
  })

  // Cercar no és operar: sense verificar es veu el cercador, però no es pot triar cap actiu per comprar (US6.1)
  it('sense verificar mostra el cercador però no deixa triar actius', async () => {
    apiGet.mockResolvedValue({ verificacio: { estat: 'pendent', termes_acceptats: false } })
    const wrapper = await mountActius()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(wrapper.findComponent({ name: 'AssetSearch' }).props('selectable')).toBe(false)
    expect(apiGet).not.toHaveBeenCalledWith('/account/positions')
  })

  it('amb el compte verificat llegeix les posicions i les passa al cercador', async () => {
    mockVerifiedUser()
    const wrapper = await mountActius()

    const search = wrapper.findComponent({ name: 'AssetSearch' })
    expect(search.props('selectable')).toBe(true)
    expect(search.props('holdings')).toEqual({ 7: 3 })
  })

  it('"Compra" obre la targeta de compra i "Ven" la de venda, una sola alhora', async () => {
    mockVerifiedUser()
    const wrapper = await mountActius()
    const search = wrapper.findComponent({ name: 'AssetSearch' })

    search.vm.$emit('select', APPLE)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'BuyCard' }).props('asset')).toEqual(APPLE)
    expect(wrapper.findComponent({ name: 'SellCard' }).exists()).toBe(false)

    search.vm.$emit('sell', APPLE)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'SellCard' }).props('asset')).toEqual(APPLE)
    expect(wrapper.findComponent({ name: 'BuyCard' }).exists()).toBe(false)

    wrapper.findComponent({ name: 'SellCard' }).vm.$emit('close')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'SellCard' }).exists()).toBe(false)
  })

  it("ja no mostra el saldo ni l'avís de verificació", async () => {
    const wrapper = await mountActius()

    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(false)
    expect(wrapper.find('[data-test="verification-required"]').exists()).toBe(false)
  })

  describe('actualitat del mercat (US17.1)', () => {
    const NVIDIA = { id: 5, name: 'NVIDIA', ticker: 'NVDA', type: 'accio', daily_change_pct: '2.47' }
    const TESLA = { id: 6, name: 'Tesla', ticker: 'TSLA', type: 'accio', daily_change_pct: '-3.12' }
    const APPLE_FLAT = { id: 7, name: 'Apple', ticker: 'AAPL', type: 'accio', daily_change_pct: '0.00' }

    // Catàleg de GET /assets; la resta de crides, com un usuari sense verificar
    function mockCatalog(...catalogs) {
      apiGet.mockImplementation(async (path) => {
        if (path === '/assets') return catalogs.length > 1 ? catalogs.shift() : catalogs[0]
        return { verificacio: { estat: 'pendent', termes_acceptats: false } }
      })
    }

    const noteTexts = (wrapper) => wrapper.findAll('[data-test="market-note"] strong').map((n) => n.text().replace(/\s/g, ' '))

    // C1: la secció surt a dalt d'Actius, entre la capçalera i el cercador, amb els avisos del catàleg sencer
    it('mostra els avisos del catàleg entre la capçalera i el cercador', async () => {
      mockCatalog([NVIDIA, TESLA, APPLE_FLAT])
      const wrapper = await mountActius()

      expect(apiGet).toHaveBeenCalledWith('/assets')
      expect(wrapper.get('[data-test="market-feed"]').text()).toContain('Actualitat del mercat')
      expect(noteTexts(wrapper)).toEqual([
        'NVIDIA és el valor que més puja: +2,47 %',
        'Tesla és el valor que més baixa: −3,12 %',
      ])
      const html = wrapper.html()
      expect(html.indexOf('market-feed')).toBeLessThan(html.indexOf('asset-search-stub'))
    })

    // C2: si cap actiu no es mou prou, la secció ho diu
    it('sense moviments mostra "No hi ha moviments destacats"', async () => {
      mockCatalog([APPLE_FLAT])
      const wrapper = await mountActius()

      expect(wrapper.get('[data-test="market-feed"]').text()).toContain('No hi ha moviments destacats')
      expect(wrapper.findAll('[data-test="market-note"]')).toHaveLength(0)
    })

    // Si no es pot carregar el catàleg, la secció no surt
    it('si el catàleg no es pot carregar, no mostra la secció', async () => {
      apiGet.mockImplementation(async (path) => {
        if (path === '/assets') throw new Error('xarxa')
        return { verificacio: { estat: 'pendent', termes_acceptats: false } }
      })
      const wrapper = await mountActius()

      expect(wrapper.find('[data-test="market-feed"]').exists()).toBe(false)
    })

    // C3: els avisos es tornen a calcular quan la cinta comença una volta, amb la variació d'aquell moment
    it('en començar una volta torna a calcular els avisos', async () => {
      mockCatalog([NVIDIA, TESLA], [{ ...NVIDIA, daily_change_pct: '1.10' }, TESLA])
      const wrapper = await mountActius()

      wrapper.findComponent({ name: 'MarketFeed' }).vm.$emit('loop')
      await flushPromises()

      expect(noteTexts(wrapper)[0]).toBe('NVIDIA és el valor que més puja: +1,10 %')
    })

    // C6: en prémer un avís, el cercador s'omple amb el ticker
    it('en prémer un avís omple el cercador amb el ticker', async () => {
      mockCatalog([NVIDIA, TESLA])
      const wrapper = await mountActius()

      await wrapper.findAll('[data-test="market-note"]')[1].trigger('click')

      expect(wrapper.findComponent({ name: 'AssetSearch' }).props('query')).toBe('TSLA')
    })
  })
})
