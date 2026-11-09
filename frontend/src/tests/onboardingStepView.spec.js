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
// Supabase i API falsos: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost, ApiError } from '../services/api'

const { COMPLETED, PENDING } = STEP_STATUS

// El backend retorna com a completats els passos indicats
function mockBackend(completedIds = []) {
  apiGet.mockResolvedValue({
    onboarding: {
      steps: ONBOARDING_STEPS.map((s) => ({
        id: s.id,
        status: completedIds.includes(s.id) ? COMPLETED : PENDING,
      })),
    },
  })
}

async function mountAt(step, stubs = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/onboarding', name: 'onboarding', component: { render: () => null } },
      { path: '/onboarding/:step', name: 'onboarding-step', component: OnboardingStepView },
    ],
  })
  router.push(`/onboarding/${step}`)
  await router.isReady()
  const wrapper = mount(OnboardingStepView, { global: { plugins: [router], stubs } })
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
    mockBackend(['dades-personals', 'verificacio-identitat'])
    const { wrapper, router } = await mountAt('verificacio-identitat')

    await clickComplete(wrapper)

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(router.currentRoute.value.fullPath).toBe('/onboarding/questionari-inversor')
  })

  it('torna a un pas anterior si encara està pendent', async () => {
    mockBackend(['questionari-inversor', 'verificacio-identitat'])
    const { wrapper, router } = await mountAt('verificacio-identitat')

    await clickComplete(wrapper)

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
  })

  it('es queda al mateix pas si el backend encara el té pendent', async () => {
    mockBackend(['dades-personals', 'questionari-inversor'])
    const { wrapper, router } = await mountAt('verificacio-identitat')

    await clickComplete(wrapper)

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/verificacio-identitat')
  })

  it('amb tots els passos fets torna a la benvinguda', async () => {
    mockBackend(ONBOARDING_STEPS.map((s) => s.id))
    const { wrapper, router } = await mountAt('verificacio-identitat')

    await clickComplete(wrapper)

    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it('si el backend falla mostra un error i no canvia de pas', async () => {
    apiGet.mockRejectedValue(new Error('Error de xarxa'))
    const { wrapper, router } = await mountAt('verificacio-identitat')

    await clickComplete(wrapper)

    expect(wrapper.text()).toContain("No s'ha pogut comprovar el progrés.")
    expect(router.currentRoute.value.fullPath).toBe('/onboarding/verificacio-identitat')
  })

  describe('pas del qüestionari', () => {
    const QuestionnaireStub = {
      template: '<button data-test="questionnaire-stub" @click="$emit(\'submit\', { experiencia: \'cap\' })" />',
    }
    const continueButton = (wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Continua')

    it('mostra el qüestionari en lloc dels botons provisionals', async () => {
      mockBackend()
      const { wrapper } = await mountAt('questionari-inversor')

      expect(wrapper.findAll('[data-test="question"]')).toHaveLength(5)
      expect(completeButton(wrapper)).toBeUndefined()
    })

    it('envia les respostes al backend i mostra el perfil que retorna', async () => {
      mockBackend()
      apiPost.mockResolvedValue({ profile: 'intermedi' })
      const { wrapper } = await mountAt('questionari-inversor', { InvestorQuestionnaire: QuestionnaireStub })

      await wrapper.get('[data-test="questionnaire-stub"]').trigger('click')
      await flushPromises()

      expect(apiPost).toHaveBeenCalledWith('/profile/investor-questionnaire', { experiencia: 'cap' })
      expect(wrapper.get('[data-test="result"]').text()).toContain('Intermedi')
      expect(wrapper.find('[data-test="questionnaire-stub"]').exists()).toBe(false)
    })

    it("en continuar torna a carregar l'estat i passa al següent pas", async () => {
      mockBackend(['dades-personals', 'questionari-inversor'])
      apiPost.mockResolvedValue({ profile: 'principiant' })
      const { wrapper, router } = await mountAt('questionari-inversor', { InvestorQuestionnaire: QuestionnaireStub })

      await wrapper.get('[data-test="questionnaire-stub"]').trigger('click')
      await flushPromises()
      await continueButton(wrapper).trigger('click')
      await flushPromises()

      expect(apiGet).toHaveBeenCalledWith('/users/me')
      expect(router.currentRoute.value.fullPath).toBe('/onboarding/verificacio-identitat')
    })

    it('si el backend rebutja les respostes mostra un error i es queda al qüestionari', async () => {
      mockBackend()
      apiPost.mockRejectedValue(new ApiError(422, 'Resposta no vàlida'))
      const { wrapper } = await mountAt('questionari-inversor', { InvestorQuestionnaire: QuestionnaireStub })

      await wrapper.get('[data-test="questionnaire-stub"]').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain("No s'ha pogut desar el teu perfil.")
      expect(wrapper.find('[data-test="result"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="questionnaire-stub"]').exists()).toBe(true)
    })
  })

  describe('pas de dades personals', () => {
    const FormStub = { template: '<button data-test="form-stub" @click="$emit(\'saved\')" />' }

    it('mostra el formulari en lloc dels botons provisionals', async () => {
      mockBackend()
      const { wrapper } = await mountAt('dades-personals')

      expect(wrapper.find('form').exists()).toBe(true)
      expect(completeButton(wrapper)).toBeUndefined()
    })

    it("en desar el formulari torna a carregar l'estat i passa al següent pas", async () => {
      mockBackend(['dades-personals'])
      const { wrapper, router } = await mountAt('dades-personals', { DadesPersonalsForm: FormStub })

      await wrapper.get('[data-test="form-stub"]').trigger('click')
      await flushPromises()

      expect(apiGet).toHaveBeenCalledWith('/users/me')
      expect(router.currentRoute.value.fullPath).toBe('/onboarding/questionari-inversor')
    })

    it('si el backend no el dona per completat, es queda al formulari', async () => {
      mockBackend([])
      const { wrapper, router } = await mountAt('dades-personals', { DadesPersonalsForm: FormStub })

      await wrapper.get('[data-test="form-stub"]').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
    })
  })
})
