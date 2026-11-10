import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet } from '../services/api'
import ActiusView from '../views/ActiusView.vue'

let backend

async function mountActius() {
  const blank = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/actius', name: 'actius', component: ActiusView },
      { path: '/onboarding', name: 'onboarding', component: blank },
    ],
  })
  router.push('/actius')
  await router.isReady()
  // El saldo té els seus propis tests (balanceCard.spec.js)
  const wrapper = mount(ActiusView, { global: { plugins: [router], stubs: { BalanceCard: true } } })
  await flushPromises()
  return { wrapper, router }
}

describe('ActiusView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    backend = { '/users/me': { verificacio: { estat: 'verificat', termes_acceptats: true } } }
    apiGet.mockImplementation(async (path) => backend[path])
  })

  it('mostra el saldo amb la identitat verificada i els termes acceptats', async () => {
    const { wrapper } = await mountActius()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(true)
    expect(wrapper.find('[data-test="verification-required"]').exists()).toBe(false)
  })

  it('amaga el saldo i mostra el banner si la identitat no està verificada', async () => {
    backend['/users/me'] = { verificacio: { estat: 'pendent', termes_acceptats: false } }
    const { wrapper } = await mountActius()

    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(false)
    expect(wrapper.get('[data-test="verification-required"]').text()).toContain('Verifica la teva identitat')
  })

  it('amaga el saldo si falten els termes encara que la identitat estigui verificada', async () => {
    backend['/users/me'] = { verificacio: { estat: 'verificat', termes_acceptats: false } }
    const { wrapper } = await mountActius()

    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(false)
    expect(wrapper.find('[data-test="verification-required"]').exists()).toBe(true)
  })

  it("el banner porta a la pantalla de l'onboarding", async () => {
    backend['/users/me'] = { verificacio: { estat: 'pendent', termes_acceptats: false } }
    const { wrapper, router } = await mountActius()

    await wrapper.get('[data-test="verification-required"] button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/onboarding')
  })

  it("si no es pot comprovar l'estat, mostra l'error i no el saldo", async () => {
    apiGet.mockRejectedValue(new Error('xarxa'))
    const { wrapper } = await mountActius()

    expect(wrapper.text()).toContain("No s'ha pogut comprovar l'estat de la verificació")
    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(false)
  })
})
