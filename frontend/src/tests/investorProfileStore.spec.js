import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import { useInvestorProfileStore } from '../stores/investorProfile'
import { INVESTOR_QUESTIONS } from '../utils/investorQuestions'

vi.mock('../services/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))

import { supabase } from '../services/supabase'

// Totes les preguntes respostes amb l'última opció (10 punts → avançat)
const expertAnswers = Object.fromEntries(INVESTOR_QUESTIONS.map((q) => [q.id, q.options.at(-1).id]))

// updateUser retorna l'usuari amb les metadades que s'han enviat, com Supabase
function mockSupabaseSave() {
  supabase.auth.updateUser.mockImplementation(async ({ data }) => ({
    data: { user: { id: 'u1', user_metadata: data } },
    error: null,
  }))
}

describe("store del perfil d'inversor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useAuthStore().user = { id: 'u1', user_metadata: {} }
  })

  it('sense qüestionari fet no té perfil', () => {
    const store = useInvestorProfileStore()
    expect(store.hasProfile).toBe(false)
    expect(store.profile).toBeNull()
  })

  it('llegeix el perfil desat a user_metadata', () => {
    useAuthStore().user = { id: 'u1', user_metadata: { investor_profile: { profile: 'intermedi', score: 5 } } }
    const store = useInvestorProfileStore()

    expect(store.profile).toBe('intermedi')
    expect(store.profileLabel).toBe('Intermedi')
  })

  it('calcula el perfil, el desa a Supabase i el deixa a la memòria de l\'app', async () => {
    mockSupabaseSave()
    const store = useInvestorProfileStore()

    const profile = await store.submitAnswers(expertAnswers)

    expect(profile).toBe('avancat')
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: {
        investor_profile: expect.objectContaining({ profile: 'avancat', score: 10, answers: expertAnswers }),
      },
    })
    expect(store.profileLabel).toBe('Avançat')
  })

  it('no desa res si falta alguna resposta', async () => {
    const store = useInvestorProfileStore()

    await expect(store.submitAnswers({ experiencia: 'cap' })).rejects.toThrow()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it("propaga l'error de Supabase i no assigna el perfil", async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: new Error('Error de xarxa') })
    const store = useInvestorProfileStore()

    await expect(store.submitAnswers(expertAnswers)).rejects.toThrow('Error de xarxa')
    expect(store.hasProfile).toBe(false)
  })
})
