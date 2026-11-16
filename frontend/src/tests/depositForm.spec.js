import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiPost: vi.fn(),
}))

import { apiPost } from '../services/api'
import DepositForm from '../components/DepositForm.vue'

async function submit(wrapper, amount) {
  await wrapper.get('[data-test="deposit-amount"]').setValue(amount)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('DepositForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it("no crida el backend si l'import no és vàlid", async () => {
    const wrapper = mount(DepositForm)

    await submit(wrapper, '0,50')

    expect(apiPost).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("L'import mínim d'ingrés és d'1 €.")
  })

  it("envia l'import normalitzat i buida el camp", async () => {
    apiPost.mockResolvedValue({ balance: '150.25' })
    const wrapper = mount(DepositForm)

    await submit(wrapper, '50,25')

    expect(apiPost).toHaveBeenCalledWith('/account/deposits', { amount: '50.25' })
    expect(wrapper.get('[data-test="deposit-amount"]').element.value).toBe('')
  })

  it('si no arriba al backend, avisa que el saldo no ha canviat', async () => {
    apiPost.mockRejectedValue(new TypeError('Failed to fetch'))
    const wrapper = mount(DepositForm)

    await submit(wrapper, '50')

    expect(wrapper.text()).toContain("No s'ha pogut processar el dipòsit. El teu saldo no ha canviat.")
  })
})
