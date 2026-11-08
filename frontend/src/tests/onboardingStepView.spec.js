import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ONBOARDING_STEPS } from '../stores/onboarding'
import { STEP_STATUS } from '../utils/onboarding'
import OnboardingStepView from '../views/OnboardingStepView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
// API falsa: cap crida de xarxa al backend
vi.mock('../services/api', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '../services/api'

const { COMPLETED, PENDING } = STEP_STATUS

// El backend retorna com a completats els passos indicats
function mockBackend(completedIds = []) {
  apiRequest.mockResolvedValue({
    onboarding: {
      steps: ONBOARDING_STEPS.map((s) => ({
        id: s.id,
        status: completedIds.includes(s.id) ? COMPLETED : PENDING,
      })),
    },
  })
}

async function mountAt(step) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/onboarding', name: 'onboarding', component: { render: () => null } },
      { path: '/onboarding/:step', name: 'onboarding-step', component: OnboardingStepView },
    ],
  })
  router.push(`/onboarding/${step}`)
  await router.isReady()
  const wrapper = mount(OnboardingStepView, { global: { plugins: [router] } })
  return { wrapper, router }
}

const completeButton = (wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Completa el pas')

async function clickComplete(wrapper) {
  await completeButton(wrapper).trigger('click')
  await flushPromises()
}

describe('OnboardingStepView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('mostra el pas i la seva posició', async () => {
    const { wrapper } = await mountAt('questionari-inversor')

    expect(wrapper.text()).toContain('Pas 2 de 3')
    expect(wrapper.text()).toContain("Qüestionari d'experiència inversora")
  })

  it("torna a carregar l'estat i salta al següent pas pendent", async () => {
    mockBackend(['dades-personals'])
    const { wrapper, router } = await mountAt('dades-personals')

    await clickComplete(wrapper)

    expect(apiRequest).toHaveBeenCalledWith('/users/me')
    expect(router.currentRoute.value.fullPath).toBe('/onboarding/questionari-inversor')
  })

  it('salta un pas que ja estava fet', async () => {
    mockBackend(['dades-personals', 'questionari-inversor'])
    const { wrapper, router } = await mountAt('dades-personals')

    await clickComplete(wrapper)

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/verificacio-identitat')
  })

  it('es queda al mateix pas si el backend encara el té pendent', async () => {
    mockBackend([])
    const { wrapper, router } = await mountAt('dades-personals')

    await clickComplete(wrapper)

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
  })

  it('amb tots els passos fets torna a la benvinguda', async () => {
    mockBackend(ONBOARDING_STEPS.map((s) => s.id))
    const { wrapper, router } = await mountAt('verificacio-identitat')

    await clickComplete(wrapper)

    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it('si el backend falla mostra un error i no canvia de pas', async () => {
    apiRequest.mockRejectedValue(new Error('Error de xarxa'))
    const { wrapper, router } = await mountAt('dades-personals')

    await clickComplete(wrapper)

    expect(wrapper.text()).toContain("No s'ha pogut comprovar el progrés.")
    expect(router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
  })
})
