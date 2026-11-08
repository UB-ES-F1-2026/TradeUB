import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ONBOARDING_STEPS, useOnboardingStore } from '../stores/onboarding'
import { STEP_STATUS } from '../utils/onboarding'

// API falsa: cap crida de xarxa al backend
vi.mock('../services/api', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '../services/api'

const { COMPLETED, PENDING } = STEP_STATUS

// Resposta de GET /users/me amb els passos indicats com a completats, com la retorna el backend
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

describe('store de l\'onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('abans de carregar té els passos en ordre i tots pendents', () => {
    const store = useOnboardingStore()

    expect(store.steps.map((s) => s.id)).toEqual(ONBOARDING_STEPS.map((s) => s.id))
    expect(store.steps.every((s) => s.status === PENDING)).toBe(true)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("carrega l'estat dels passos de GET /users/me", async () => {
    mockBackend(['dades-personals'])
    const store = useOnboardingStore()

    await store.load()

    expect(apiRequest).toHaveBeenCalledWith('/users/me')
    expect(store.getStep('dades-personals').status).toBe(COMPLETED)
    expect(store.getStep('questionari-inversor').status).toBe(PENDING)
  })

  it('ignora valors desconeguts i els tracta com a pendents', async () => {
    apiRequest.mockResolvedValue({
      onboarding: { steps: [{ id: 'dades-personals', status: 'qualsevol-cosa' }] },
    })
    const store = useOnboardingStore()

    await store.load()

    expect(store.getStep('dades-personals').status).toBe(PENDING)
  })

  it('calcula el progrés i el següent pas pendent', async () => {
    mockBackend(['dades-personals'])
    const store = useOnboardingStore()

    await store.load()

    expect(store.progress).toBe(33)
    expect(store.nextStep.id).toBe('questionari-inversor')
    expect(store.isComplete).toBe(false)
  })

  it('està complet quan no queda cap pas pendent', async () => {
    mockBackend(ONBOARDING_STEPS.map((s) => s.id))
    const store = useOnboardingStore()

    await store.load()

    expect(store.progress).toBe(100)
    expect(store.nextStep).toBeNull()
    expect(store.isComplete).toBe(true)
  })

  it('retorna null per a un pas que no existeix', () => {
    expect(useOnboardingStore().getStep('no-existeix')).toBeNull()
  })

  it("propaga l'error del backend i no canvia l'estat", async () => {
    mockBackend(['dades-personals'])
    const store = useOnboardingStore()
    await store.load()
    apiRequest.mockRejectedValue(new Error('Error de xarxa'))

    await expect(store.load()).rejects.toThrow('Error de xarxa')
    expect(store.progress).toBe(33)
  })
})
