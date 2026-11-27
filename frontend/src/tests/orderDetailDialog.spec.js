import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet, ApiError } from '../services/api'
import OrderDetailDialog from '../components/OrderDetailDialog.vue'

const plain = (text) => text.replace(/\s/g, ' ')

const BUY = {
  id: 'ordre-1',
  side: 'compra',
  status: 'executada',
  asset: { id: 7, name: 'Apple Inc.', ticker: 'AAPL' },
  units: '3.00000000',
  price: '212.400000',
  amount: '637.20',
  commission: '1.00',
  total: '638.20',
  created_at: '2026-11-26T09:42:00+00:00',
  executed_at: '2026-11-26T09:42:00+00:00',
  balance_after: '9361.80',
}

async function mountDetail(orderId = 'ordre-1') {
  const wrapper = mount(OrderDetailDialog, { props: { orderId }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const field = (wrapper, key) => plain(wrapper.get(`[data-test="order-${key}"] dd`).text())

describe('OrderDetailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it("demana l'ordre i en mostra el detall amb el títol del criteri", async () => {
    apiGet.mockResolvedValue(BUY)
    const wrapper = await mountDetail()

    expect(apiGet).toHaveBeenCalledWith('/orders/ordre-1')
    expect(wrapper.get('h2').text()).toBe("Detall de l'operació")
    expect(field(wrapper, 'side')).toBe('Compra')
    expect(plain(wrapper.get('[data-test="order-headline"]').text())).toBe('−638,20 €')
    expect(wrapper.get('[data-test="order-concept"]').text()).toBe('Compra de 3 AAPL')
    expect(wrapper.get('[data-test="order-status"]').text()).toBe('Executada')
    expect(field(wrapper, 'asset')).toBe('Apple Inc. · AAPL')
    expect(field(wrapper, 'units')).toBe('3')
    expect(field(wrapper, 'price')).toBe('212,40 €')
    expect(field(wrapper, 'amount')).toBe('637,20 €')
    expect(field(wrapper, 'commission')).toBe('1,00 €')
    expect(wrapper.get('[data-test="order-total"] dt').text()).toBe('Total carregat')
    expect(field(wrapper, 'total')).toBe('638,20 €')
    expect(field(wrapper, 'balance')).toBe('9.361,80 €')
  })

  it('en una venda mostra l\'import net abonat', async () => {
    apiGet.mockResolvedValue({ ...BUY, side: 'venda', total: '636.20' })
    const wrapper = await mountDetail()

    expect(wrapper.get('[data-test="order-total"] dt').text()).toBe('Import net abonat')
    expect(field(wrapper, 'total')).toBe('636,20 €')
  })

  it("si l'ordre no existeix mostra el missatge del backend", async () => {
    apiGet.mockRejectedValue(new ApiError(404, 'Operació no trobada'))
    const wrapper = await mountDetail()

    expect(wrapper.get('[data-test="order-error"]').text()).toBe('Operació no trobada')
  })

  it('si el backend falla mostra un error general', async () => {
    apiGet.mockRejectedValue(new ApiError(500, "No s'ha pogut recuperar l'operació"))
    const wrapper = await mountDetail()

    expect(wrapper.get('[data-test="order-error"]').text()).toBe(
      "No s'ha pogut carregar el detall de l'operació. Torna-ho a provar.",
    )
  })

  it('"Tanca" i "×" demanen tancar-lo', async () => {
    apiGet.mockResolvedValue(BUY)
    const wrapper = await mountDetail()

    await wrapper.get('[data-test="order-close"]').trigger('click')
    await wrapper.get('[data-test="ui-dialog-close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('sense ordre no es mostra ni demana res', async () => {
    const wrapper = await mountDetail(null)

    expect(apiGet).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="ui-dialog"]').exists()).toBe(false)
  })
})
