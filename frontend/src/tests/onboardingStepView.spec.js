import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { STEP_STATUS } from '../utils/onboarding'
import OnboardingStepView from '../views/OnboardingStepView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('../services/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))

import { supabase } from '../services/supabase'

const { COMPLETED } = STEP_STATUS

// updateUser retorna l'usuari amb les metadades que s'han enviat, com Supabase
function mockSupabaseSave() {
  supabase.auth.updateUser.mockImplementation(async ({ data }) => ({
    data: { user: { id: 'u1', user_metadata: data } },
    error: null,
  }))
}

async function mountAt(step, onboarding = {}) {
  useAuthStore().user = { id: 'u1', user_metadata: { onboarding } }
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

  it('en completar un pas salta automàticament al següent pas pendent', async () => {
    mockSupabaseSave()
    const { wrapper, router } = await mountAt('dades-personals')

    await completeButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/questionari-inversor')
  })

  it('salta un pas que ja estava fet', async () => {
    mockSupabaseSave()
    const { wrapper, router } = await mountAt('dades-personals', { 'questionari-inversor': COMPLETED })

    await completeButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/verificacio-identitat')
  })

  it("en completar l'últim pas pendent torna a la benvinguda", async () => {
    mockSupabaseSave()
    const { wrapper, router } = await mountAt('verificacio-identitat', {
      'dades-personals': COMPLETED,
      'questionari-inversor': COMPLETED,
    })

    await completeButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it("si no es pot desar mostra un error i no canvia de pas", async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: new Error('Error de xarxa') })
    const { wrapper, router } = await mountAt('dades-personals')

    await completeButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("No s'ha pogut desar el pas.")
    expect(router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
  })
})
