import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet, ApiError } from '../services/api'
import BalanceCard from '../components/BalanceCard.vue'
import { formatCurrency } from '../utils/currency'

// Intl separa l'import i el símbol amb un espai no separable
const text = (wrapper, sel) => wrapper.get(sel).text().replace(/\s/g, ' ')

describe('formatCurrency', () => {
  it('formata en euros amb el format català', () => {
    expect(formatCurrency(12345.6).replace(/\s/g, ' ')).toBe('12.345,60 €')
    expect(formatCurrency(0).replace(/\s/g, ' ')).toBe('0,00 €')
  })
})

describe('BalanceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('mostra el saldo total, el disponible i el reservat', async () => {
    apiGet.mockResolvedValue({ balance: '10000.5', currency: 'EUR', updated_at: null })

    const wrapper = mount(BalanceCard)
    await flushPromises()

    expect(apiGet).toHaveBeenCalledWith('/account/balance')
    expect(text(wrapper, '[data-test="total"]')).toBe('10.000,50 €')
    expect(text(wrapper, '[data-test="available"]')).toBe('10.000,50 €')
    expect(text(wrapper, '[data-test="reserved"]')).toBe('0,00 €')
    expect(wrapper.text()).toContain('Saldo disponible')
    expect(wrapper.text()).toContain('Saldo reservat')
  })

  it("mostra l'error si no es pot carregar el saldo", async () => {
    apiGet.mockRejectedValue(new ApiError(404, 'Compte no trobat'))

    const wrapper = mount(BalanceCard)
    await flushPromises()

    expect(wrapper.text()).toContain('Encara no tens cap compte virtual.')
    expect(wrapper.find('[data-test="total"]').exists()).toBe(false)
  })
})
