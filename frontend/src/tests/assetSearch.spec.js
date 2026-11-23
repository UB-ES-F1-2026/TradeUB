import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet, ApiError } from '../services/api'
import AssetSearch from '../components/AssetSearch.vue'
import { SEARCH_DELAY_MS } from '../utils/assets'

const APPLE = { name: 'Apple Inc.', ticker: 'AAPL', type: 'accio' }
const MSCI = { name: 'iShares Core MSCI World', ticker: 'IWDA', type: 'etf' }

// Espera que passi el retard de la cerca i que arribi la resposta
async function typeAndWait(wrapper, text) {
  await wrapper.get('[data-test="asset-search"]').setValue(text)
  await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS + 20))
  await flushPromises()
}

function results(wrapper) {
  return wrapper.findAll('[data-test="asset-result"]').map((r) => r.text())
}

describe('AssetSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('en obrir-se mostra tot el catàleg amb el tipus traduït', async () => {
    apiGet.mockResolvedValue([APPLE, MSCI])
    const wrapper = mount(AssetSearch)
    await flushPromises()

    expect(apiGet).toHaveBeenCalledWith('/assets')
    expect(results(wrapper)).toEqual(['Apple Inc.AAPLAcció', 'iShares Core MSCI WorldIWDAETF'])
  })

  it('cerca el text escrit quan l\'usuari para d\'escriure', async () => {
    apiGet.mockResolvedValue([APPLE, MSCI])
    const wrapper = mount(AssetSearch)
    await flushPromises()
    apiGet.mockResolvedValue([APPLE])

    await typeAndWait(wrapper, 'aapl')

    expect(apiGet).toHaveBeenLastCalledWith('/assets?q=aapl')
    expect(results(wrapper)).toEqual(['Apple Inc.AAPLAcció'])
  })

  it('fa una sola petició encara que s\'escrigui de pressa', async () => {
    apiGet.mockResolvedValue([])
    const wrapper = mount(AssetSearch)
    await flushPromises()
    apiGet.mockClear()

    const input = wrapper.get('[data-test="asset-search"]')
    await input.setValue('a')
    await input.setValue('ap')
    await typeAndWait(wrapper, 'app')

    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet).toHaveBeenCalledWith('/assets?q=app')
  })

  it('sense resultats mostra el missatge del criteri', async () => {
    apiGet.mockResolvedValue([APPLE])
    const wrapper = mount(AssetSearch)
    await flushPromises()
    apiGet.mockResolvedValue([])

    await typeAndWait(wrapper, 'zzz')

    expect(wrapper.get('[data-test="no-results"]').text()).toBe("No s'han trobat actius")
  })

  it('si el backend falla mostra un error', async () => {
    apiGet.mockRejectedValue(new ApiError(500, "No s'ha pogut recuperar el catàleg d'actius"))
    const wrapper = mount(AssetSearch)
    await flushPromises()

    expect(wrapper.text()).toContain("No s'ha pogut carregar el catàleg d'actius. Torna-ho a provar.")
    expect(results(wrapper)).toEqual([])
  })

  it('una resposta antiga no substitueix la de la cerca més nova', async () => {
    apiGet.mockResolvedValue([])
    const wrapper = mount(AssetSearch)
    await flushPromises()

    let resolveOld
    apiGet.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    await typeAndWait(wrapper, 'ms')
    apiGet.mockResolvedValueOnce([APPLE])
    await typeAndWait(wrapper, 'apple')

    resolveOld([MSCI])
    await flushPromises()

    expect(results(wrapper)).toEqual(['Apple Inc.AAPLAcció'])
  })

  // Compra (US6.1): només qui pot operar pot triar un resultat
  it('per defecte no mostra el botó "Compra"', async () => {
    apiGet.mockResolvedValue([APPLE])
    const wrapper = mount(AssetSearch)
    await flushPromises()

    expect(wrapper.find('[data-test="asset-select"]').exists()).toBe(false)
  })

  it('amb selectable, "Compra" emet l\'actiu triat', async () => {
    apiGet.mockResolvedValue([APPLE, MSCI])
    const wrapper = mount(AssetSearch, { props: { selectable: true } })
    await flushPromises()

    const buttons = wrapper.findAll('[data-test="asset-select"]')
    expect(buttons).toHaveLength(2)
    expect(buttons[1].attributes('aria-label')).toBe('Comprar iShares Core MSCI World')

    await buttons[1].trigger('click')

    expect(wrapper.emitted('select')).toEqual([[MSCI]])
  })

  // Venda (US6.2): "Ven" només surt als actius dels quals l'usuari té unitats
  describe('"Ven"', () => {
    const OWNED = { id: 7, ...APPLE }
    const NOT_OWNED = { id: 9, ...MSCI }

    it("només surt als actius amb unitats i emet l'actiu", async () => {
      apiGet.mockResolvedValue([OWNED, NOT_OWNED])
      const wrapper = mount(AssetSearch, { props: { selectable: true, holdings: { 7: 3 } } })
      await flushPromises()

      const buttons = wrapper.findAll('[data-test="asset-sell"]')
      expect(buttons).toHaveLength(1)
      expect(buttons[0].attributes('aria-label')).toBe('Vendre Apple Inc.')

      await buttons[0].trigger('click')

      expect(wrapper.emitted('sell')).toEqual([[OWNED]])
    })

    it('sense selectable no surt encara que hi hagi unitats', async () => {
      apiGet.mockResolvedValue([OWNED])
      const wrapper = mount(AssetSearch, { props: { holdings: { 7: 3 } } })
      await flushPromises()

      expect(wrapper.find('[data-test="asset-sell"]').exists()).toBe(false)
    })
  })
})
