import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import { STEP_STATUS } from '../utils/onboarding'
import OnboardingView from '../views/OnboardingView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('../services/supabase', () => ({
  supabase: { auth: {} },
}))

function mountWith(onboarding = {}) {
  useAuthStore().user = { id: 'u1', user_metadata: { onboarding } }
  return mount(OnboardingView)
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
    const wrapper = mountWith({
      'dades-personals': STEP_STATUS.COMPLETED,
      'questionari-inversor': STEP_STATUS.COMPLETED,
      'verificacio-identitat': STEP_STATUS.COMPLETED,
    })

    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('100 %')
  })
})
