import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { STEP_STATUS } from '../utils/onboarding'
import OnboardingView from '../views/OnboardingView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('../services/supabase', () => ({
  supabase: { auth: {} },
}))

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

function mountWith(onboarding = {}) {
  useAuthStore().user = { id: 'u1', user_metadata: { onboarding } }
  const router = makeRouter()
  const wrapper = mount(OnboardingView, { global: { plugins: [router] } })
  return Object.assign(wrapper, { router })
}

const allCompleted = {
  'dades-personals': STEP_STATUS.COMPLETED,
  'questionari-inversor': STEP_STATUS.COMPLETED,
  'verificacio-identitat': STEP_STATUS.COMPLETED,
}

describe('OnboardingView', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('mostra una targeta per cada pas, en ordre', () => {
    const cards = mountWith().findAll('[data-test="step-card"]')

    expect(cards).toHaveLength(3)
    expect(cards[0].text()).toContain('Dades personals')
    expect(cards[1].text()).toContain("Qüestionari d'experiència inversora")
    expect(cards[2].text()).toContain('Verificació del DNI i termes')
  })

  it('marca cada pas com a pendent o completat', () => {
    const cards = mountWith({ 'dades-personals': STEP_STATUS.COMPLETED }).findAll('[data-test="step-card"]')

    expect(cards[0].text()).toContain('Completat')
    expect(cards[0].classes()).toContain('onboarding__step--done')
    expect(cards[1].text()).toContain('Pendent')
    expect(cards[1].classes()).not.toContain('onboarding__step--done')
  })

  it('omple la barra de progrés segons els passos completats', () => {
    const wrapper = mountWith({ 'dades-personals': STEP_STATUS.COMPLETED })

    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('33 %')
    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('33')
    expect(wrapper.find('.onboarding__bar-fill').attributes('style')).toContain('width: 33%')
  })

  it('amb tots els passos fets la barra arriba al 100 %', () => {
    const wrapper = mountWith(allCompleted)

    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('100 %')
  })

  it('sense cap pas fet, "Comença" porta al primer pas', async () => {
    const wrapper = mountWith()
    const launch = wrapper.find('[data-test="launch"]')

    expect(launch.text()).toBe('Comença')
    await launch.trigger('click')
    await flushPromises()

    expect(wrapper.router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
  })

  it('"Continua" porta al primer pas que queda pendent', async () => {
    const wrapper = mountWith({ 'dades-personals': STEP_STATUS.COMPLETED })
    const launch = wrapper.find('[data-test="launch"]')

    expect(launch.text()).toBe('Continua')
    await launch.trigger('click')
    await flushPromises()

    expect(wrapper.router.currentRoute.value.fullPath).toBe('/onboarding/questionari-inversor')
  })

  it("amb tots els passos fets porta a l'app", async () => {
    const wrapper = mountWith(allCompleted)

    await wrapper.find('[data-test="launch"]').trigger('click')
    await flushPromises()

    expect(wrapper.router.currentRoute.value.path).toBe('/actius')
  })
})
