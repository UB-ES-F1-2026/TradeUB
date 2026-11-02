import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

import { supabase } from '../services/supabase'
import { useAuthStore } from '../stores/auth'

const user = { id: 'u1', email: 'nom@exemple.com', user_metadata: {} }

describe('auth store: updateUserMetadata', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useAuthStore()
    store.user = user
    store.session = { access_token: 'token', user }
  })

  it('envia les dades a Supabase i actualitza l\'usuari de l\'store', async () => {
    const updated = { ...user, user_metadata: { first_name: 'Anna' } }
    supabase.auth.updateUser.mockResolvedValue({ data: { user: updated }, error: null })

    await store.updateUserMetadata({ first_name: 'Anna' })

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { first_name: 'Anna' } })
    expect(store.user).toEqual(updated)
    expect(store.session.user).toEqual(updated)
    expect(store.session.access_token).toBe('token')
  })

  it('llança l\'error de Supabase i no canvia l\'usuari', async () => {
    const apiError = new Error('error de Supabase')
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: apiError })

    await expect(store.updateUserMetadata({ first_name: 'Anna' })).rejects.toBe(apiError)

    expect(store.user).toEqual(user)
  })
})
