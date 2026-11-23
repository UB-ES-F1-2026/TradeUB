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
})
