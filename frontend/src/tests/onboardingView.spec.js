import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ONBOARDING_STEPS } from '../stores/onboarding'
import { STEP_STATUS } from '../utils/onboarding'
import OnboardingView from '../views/OnboardingView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
// API falsa: cap crida de xarxa al backend
vi.mock('../services/api', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '../services/api'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/onboarding', name: 'onboarding', component: OnboardingView },
      { path: '/onboarding/:step', name: 'onboarding-step', component: { render: () => null } },
      { path: '/actius', name: 'actius', component: { render: () => null } },
    ],
  })
}

// Munta la pantalla amb el backend retornant com a completats els passos indicats
async function mountWith(completedIds = []) {
  apiRequest.mockResolvedValue({
    onboarding: {
      steps: ONBOARDING_STEPS.map((s) => ({
        id: s.id,
        status: completedIds.includes(s.id) ? STEP_STATUS.COMPLETED : STEP_STATUS.PENDING,
      })),
    },
  })
  const router = makeRouter()
  const wrapper = mount(OnboardingView, { global: { plugins: [router] } })
  // Espera que acabi la càrrega de l'estat que es fa en muntar la pantalla
  await flushPromises()
  return Object.assign(wrapper, { router })
}

const allCompleted = ONBOARDING_STEPS.map((s) => s.id)

describe('OnboardingView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it("carrega l'estat del backend en obrir la pantalla", async () => {
    await mountWith()

    expect(apiRequest).toHaveBeenCalledWith('/users/me')
  })

  it('si el backend falla mostra un avís i els passos pendents', async () => {
    apiRequest.mockRejectedValue(new Error('Error de xarxa'))
    const wrapper = mount(OnboardingView, { global: { plugins: [makeRouter()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("No s'ha pogut carregar el teu progrés.")
    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('0 %')
  })

  it('mostra una targeta per cada pas, en ordre', async () => {
    const cards = (await mountWith()).findAll('[data-test="step-card"]')

    expect(cards).toHaveLength(3)
    expect(cards[0].text()).toContain('Dades personals')
    expect(cards[1].text()).toContain("Qüestionari d'experiència inversora")
    expect(cards[2].text()).toContain('Verificació del DNI i termes')
  })

  it('marca cada pas com a pendent o completat', async () => {
    const cards = (await mountWith(['dades-personals'])).findAll('[data-test="step-card"]')

    expect(cards[0].text()).toContain('Completat')
    expect(cards[0].classes()).toContain('onboarding__step--done')
    expect(cards[1].text()).toContain('Pendent')
    expect(cards[1].classes()).not.toContain('onboarding__step--done')
  })

  it('omple la barra de progrés segons els passos completats', async () => {
    const wrapper = await mountWith(['dades-personals'])

    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('33 %')
    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('33')
    expect(wrapper.find('.onboarding__bar-fill').attributes('style')).toContain('width: 33%')
  })

  it('amb tots els passos fets la barra arriba al 100 %', async () => {
    const wrapper = await mountWith(allCompleted)

    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('100 %')
  })

  it('sense cap pas fet, "Comença" porta al primer pas', async () => {
    const wrapper = await mountWith()
    const launch = wrapper.find('[data-test="launch"]')

    expect(launch.text()).toBe('Comença')
    await launch.trigger('click')
    await flushPromises()

    expect(wrapper.router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
  })

  it('"Continua" porta al primer pas que queda pendent', async () => {
    const wrapper = await mountWith(['dades-personals'])
    const launch = wrapper.find('[data-test="launch"]')

    expect(launch.text()).toBe('Continua')
    await launch.trigger('click')
    await flushPromises()

    expect(wrapper.router.currentRoute.value.fullPath).toBe('/onboarding/questionari-inversor')
  })

  it('es pot deixar per més tard i anar a l\'app', async () => {
    const later = (await mountWith()).findAll('a').find((a) => a.text() === 'Ho faré més tard')
    expect(later.attributes('href')).toBe('/actius')
  })

  it("amb tots els passos fets porta a l'app", async () => {
    const wrapper = await mountWith(allCompleted)

    await wrapper.find('[data-test="launch"]').trigger('click')
    await flushPromises()

    expect(wrapper.router.currentRoute.value.path).toBe('/actius')
  })
})
