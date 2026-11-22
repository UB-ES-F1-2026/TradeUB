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

const APPLE = { name: 'Apple Inc.', ticker: 'AAPL', type: 'accio', close_price_eur: 212.4, daily_change_pct: 0.85, price_date: '2026-11-13' }
const MSCI = { name: 'iShares Core MSCI World', ticker: 'IWDA', type: 'etf', close_price_eur: 98.75, daily_change_pct: -0.41, price_date: '2026-11-13' }
const TEF = { name: 'Telefónica', ticker: 'TEF', type: 'accio', close_price_eur: 4.31, daily_change_pct: 0, price_date: '2026-11-13' }

// Espera que passi el retard de la cerca i que arribi la resposta
async function typeAndWait(wrapper, text) {
  await wrapper.get('[data-test="asset-search"]').setValue(text)
  await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS + 20))
  await flushPromises()
}

// Intl separa la xifra i el símbol (€, %) amb un espai no separable: es normalitza per comparar
const plain = (text) => text.replace(/\s/g, ' ')

function results(wrapper) {
  return wrapper.findAll('[data-test="asset-result"]').map((r) => plain(r.text()))
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
    expect(results(wrapper)).toEqual(['Apple Inc.AAPLAcció212,40 €+0,85 %13/11/2026', 'iShares Core MSCI WorldIWDAETF98,75 €−0,41 %13/11/2026'])
  })

  it('cada resultat mostra el preu de tancament en euros, la variació diària i la data de la cotització', async () => {
    apiGet.mockResolvedValue([APPLE, MSCI, TEF])
    const wrapper = mount(AssetSearch)
    await flushPromises()

    const rows = wrapper.findAll('[data-test="asset-result"]')
    expect(rows.map((r) => plain(r.get('[data-test="asset-price"]').text()))).toEqual(['212,40 €', '98,75 €', '4,31 €'])
    expect(rows.map((r) => plain(r.get('[data-test="asset-change"]').text()))).toEqual(['+0,85 %', '−0,41 %', '0,00 %'])
    expect(rows.map((r) => r.get('[data-test="asset-date"]').text())).toEqual(['13/11/2026', '13/11/2026', '13/11/2026'])
  })

  it('si falta una dada de la cotització, aquell camp mostra "No disponible"', async () => {
    apiGet.mockResolvedValue([{ ...APPLE, close_price_eur: null, daily_change_pct: null, price_date: null }])
    const wrapper = mount(AssetSearch)
    await flushPromises()

    expect(wrapper.get('[data-test="asset-price"]').text()).toBe('No disponible')
    expect(wrapper.get('[data-test="asset-change"]').text()).toBe('No disponible')
    expect(wrapper.get('[data-test="asset-change"]').classes()).toContain('assets__change--flat')
    expect(wrapper.get('[data-test="asset-date"]').text()).toBe('No disponible')
  })

  it('indica que els preus són simulats', async () => {
    apiGet.mockResolvedValue([APPLE])
    const wrapper = mount(AssetSearch)
    await flushPromises()

    expect(wrapper.get('[data-test="simulated-prices"]').text()).toBe('Preus simulats')
  })

  it('pinta la variació en verd si puja, en vermell si baixa i en gris si no canvia', async () => {
    apiGet.mockResolvedValue([APPLE, MSCI, TEF])
    const wrapper = mount(AssetSearch)
    await flushPromises()

    const changes = wrapper.findAll('[data-test="asset-change"]')
    expect(changes[0].classes()).toContain('assets__change--up')
    expect(changes[1].classes()).toContain('assets__change--down')
    expect(changes[2].classes()).toContain('assets__change--flat')
  })

  it('cerca el text escrit quan l\'usuari para d\'escriure', async () => {
    apiGet.mockResolvedValue([APPLE, MSCI])
    const wrapper = mount(AssetSearch)
    await flushPromises()
    apiGet.mockResolvedValue([APPLE])

    await typeAndWait(wrapper, 'aapl')

    expect(apiGet).toHaveBeenLastCalledWith('/assets?q=aapl')
    expect(results(wrapper)).toEqual(['Apple Inc.AAPLAcció212,40 €+0,85 %13/11/2026'])
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

    expect(results(wrapper)).toEqual(['Apple Inc.AAPLAcció212,40 €+0,85 %13/11/2026'])
  })
})
