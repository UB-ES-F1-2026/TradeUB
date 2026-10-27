import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import { ONBOARDING_STEPS, useOnboardingStore } from '../stores/onboarding'
import { STEP_STATUS } from '../utils/onboarding'

vi.mock('../services/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))

import { supabase } from '../services/supabase'

function loginWith(onboarding) {
  useAuthStore().user = { id: 'u1', user_metadata: onboarding ? { onboarding } : {} }
}

describe('store de l\'onboarding', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('té els passos en ordre i tots pendents si no hi ha res desat', () => {
    loginWith(null)
    const store = useOnboardingStore()

    expect(store.steps.map((s) => s.id)).toEqual(ONBOARDING_STEPS.map((s) => s.id))
    expect(store.steps.every((s) => s.status === STEP_STATUS.PENDING)).toBe(true)
  })

  it("llegeix l'estat desat a user_metadata", () => {
    loginWith({ 'dades-personals': STEP_STATUS.COMPLETED })
    const store = useOnboardingStore()

    expect(store.getStep('dades-personals').status).toBe(STEP_STATUS.COMPLETED)
    expect(store.getStep('questionari-inversor').status).toBe(STEP_STATUS.PENDING)
  })

  it('ignora valors desconeguts i els tracta com a pendents', () => {
    loginWith({ 'dades-personals': 'qualsevol-cosa' })
    expect(useOnboardingStore().getStep('dades-personals').status).toBe(STEP_STATUS.PENDING)
  })

  it('calcula el progrés i el següent pas pendent', () => {
    loginWith({ 'dades-personals': STEP_STATUS.COMPLETED })
    const store = useOnboardingStore()

    expect(store.progress).toBe(33)
    expect(store.nextStep.id).toBe('questionari-inversor')
    expect(store.isComplete).toBe(false)
  })

  it('està complet quan no queda cap pas pendent', () => {
    loginWith(Object.fromEntries(ONBOARDING_STEPS.map((s) => [s.id, STEP_STATUS.COMPLETED])))
    const store = useOnboardingStore()

    expect(store.progress).toBe(100)
    expect(store.nextStep).toBeNull()
    expect(store.isComplete).toBe(true)
  })

  it('retorna null per a un pas que no existeix', () => {
    loginWith(null)
    expect(useOnboardingStore().getStep('no-existeix')).toBeNull()
  })

  describe('completeStep', () => {
    beforeEach(() => vi.clearAllMocks())

    it('desa el pas a user_metadata sense perdre els que ja estaven fets', async () => {
      loginWith({ 'dades-personals': STEP_STATUS.COMPLETED })
      const onboarding = {
        'dades-personals': STEP_STATUS.COMPLETED,
        'questionari-inversor': STEP_STATUS.COMPLETED,
      }
      supabase.auth.updateUser.mockResolvedValue({
        data: { user: { id: 'u1', user_metadata: { onboarding } } },
        error: null,
      })
      const store = useOnboardingStore()

      await store.completeStep('questionari-inversor')

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { onboarding } })
      expect(store.getStep('questionari-inversor').status).toBe(STEP_STATUS.COMPLETED)
      expect(store.progress).toBe(67)
    })

    it('no desa res per a un pas que no existeix', async () => {
      loginWith(null)
      await useOnboardingStore().completeStep('no-existeix')
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it("propaga l'error de Supabase i no canvia l'estat", async () => {
      loginWith(null)
      supabase.auth.updateUser.mockResolvedValue({ data: {}, error: new Error('Error de xarxa') })
      const store = useOnboardingStore()

      await expect(store.completeStep('dades-personals')).rejects.toThrow('Error de xarxa')
      expect(store.progress).toBe(0)
    })
  })
})
