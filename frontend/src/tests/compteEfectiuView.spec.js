import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet } from '../services/api'
import CompteEfectiuView from '../views/CompteEfectiuView.vue'

async function mountCompte() {
  const blank = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/compte-efectiu', component: CompteEfectiuView },
      { path: '/onboarding', name: 'onboarding', component: blank },
    ],
  })
  router.push('/compte-efectiu')
  await router.isReady()
  // El saldo i el formulari tenen els seus propis tests
  const wrapper = mount(CompteEfectiuView, {
    global: { plugins: [router], stubs: { BalanceCard: true, DepositForm: true, WithdrawalForm: true } },
  })
  await flushPromises()
  return wrapper
}

describe('CompteEfectiuView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it("amb la identitat verificada i els termes acceptats mostra el saldo i els formularis d'ingrés i de retirada", async () => {
    apiGet.mockResolvedValue({ verificacio: { estat: 'verificat', termes_acceptats: true } })
    const wrapper = await mountCompte()

    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'DepositForm' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'WithdrawalForm' }).exists()).toBe(true)
    expect(wrapper.find('[data-test="verification-required"]').exists()).toBe(false)
  })

  it("sense verificar mostra l'avís per verificar-se i no el formulari", async () => {
    apiGet.mockResolvedValue({ verificacio: { estat: 'pendent', termes_acceptats: false } })
    const wrapper = await mountCompte()

    expect(wrapper.get('[data-test="verification-required"]').text()).toContain('per ingressar o retirar diners')
    expect(wrapper.findComponent({ name: 'DepositForm' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'WithdrawalForm' }).exists()).toBe(false)
  })
})
