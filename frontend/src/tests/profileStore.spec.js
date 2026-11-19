import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Supabase i API falsos: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost, ApiError } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useProfileStore } from '../stores/profile'

describe('profile store', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useProfileStore()
  })

  it('load llegeix el perfil de GET /users/me', async () => {
    apiGet.mockResolvedValue({ perfil: { nom: 'Anna' }, onboarding: { steps: [] } })

    await store.load()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(store.perfil).toEqual({ nom: 'Anna' })
    expect(store.error).toBe('')
  })

  it('si l\'usuari encara no té perfil, queda buit', async () => {
    apiGet.mockResolvedValue({ perfil: {} })

    await store.load()

    expect(store.perfil).toEqual({})
  })

  it('si load falla, mostra l\'error i manté el perfil anterior', async () => {
    apiGet.mockResolvedValueOnce({ perfil: { nom: 'Anna' } })
    await store.load()
    apiGet.mockRejectedValue(new ApiError(500, 'Error del servidor'))

    await store.load()

    expect(store.error).toBe("No s'han pogut carregar les dades personals.")
    expect(store.perfil).toEqual({ nom: 'Anna' })
    expect(store.loading).toBe(false)
  })

  it('savePersonalData envia les dades a POST /profile/personal-data i les recorda', async () => {
    apiPost.mockResolvedValue({})

    await store.savePersonalData({ nom: 'Anna', nif: '12345678Z' })

    expect(apiPost).toHaveBeenCalledWith('/profile/personal-data', { nom: 'Anna', nif: '12345678Z' })
    expect(store.perfil).toEqual({ nom: 'Anna', nif: '12345678Z' })
  })

  it('si el backend rebutja les dades, llança l\'error i no les recorda', async () => {
    const apiError = new ApiError(422, 'El format del NIF/NIE no és vàlid.')
    apiPost.mockRejectedValue(apiError)

    await expect(store.savePersonalData({ nif: 'mal' })).rejects.toBe(apiError)

    expect(store.perfil).toEqual({})
  })

  it('saveInvestorQuestionnaire envia les respostes a POST /profile/investor-questionnaire i retorna el perfil', async () => {
    apiPost.mockResolvedValue({ profile: 'avancat' })

    const profile = await store.saveInvestorQuestionnaire({ experiencia: 'habitual' })

    expect(apiPost).toHaveBeenCalledWith('/profile/investor-questionnaire', { experiencia: 'habitual' })
    expect(profile).toBe('avancat')
    expect(store.perfil.perfil_inversor).toBe('avancat')
  })

  it('loadPinStatus llegeix de GET /profile/pin si hi ha PIN configurat', async () => {
    apiGet.mockResolvedValue({ configurat: true })
    expect(store.hasPin).toBe(false)

    await store.loadPinStatus()

    expect(apiGet).toHaveBeenCalledWith('/profile/pin')
    expect(store.hasPin).toBe(true)
  })

  it('si no es pot comprovar el PIN, mostra l\'error i no se sap si n\'hi ha', async () => {
    apiGet.mockRejectedValue(new ApiError(500, "No s'ha pogut recuperar el PIN"))

    await store.loadPinStatus()

    expect(store.pinConfigured).toBeNull()
    expect(store.pinError).toBe("No s'ha pogut comprovar el PIN. Torna-ho a provar.")
  })

  it('savePin crea el PIN amb POST /profile/pin i el marca com a configurat', async () => {
    apiPost.mockResolvedValue({})

    await store.savePin({ pin: '1234' })

    expect(apiPost).toHaveBeenCalledWith('/profile/pin', { pin: '1234' })
    expect(store.hasPin).toBe(true)
  })

  it('savePin envia també el PIN actual quan es canvia', async () => {
    apiPost.mockResolvedValue({})

    await store.savePin({ pin: '5678', currentPin: '1234' })

    expect(apiPost).toHaveBeenCalledWith('/profile/pin', { pin: '5678', pin_actual: '1234' })
  })

  it('si el backend rebutja el PIN, llança l\'error i no el marca com a configurat', async () => {
    const apiError = new ApiError(403, 'Cal verificar la identitat i acceptar els termes per operar')
    apiPost.mockRejectedValue(apiError)

    await expect(store.savePin({ pin: '1234' })).rejects.toBe(apiError)

    expect(store.hasPin).toBe(false)
  })

  it('en canviar d\'usuari s\'esborra el perfil de l\'anterior', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'u1' }
    apiGet.mockResolvedValue({ perfil: { nom: 'Anna' } })
    await store.load()

    auth.user = { id: 'u2' }
    await Promise.resolve()

    expect(store.perfil).toEqual({})
  })
})
