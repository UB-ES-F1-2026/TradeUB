import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

import { supabase } from '../services/supabase'
import { useAuthStore } from '../stores/auth'

const user = { id: 'u1', email: 'nom@exemple.com' }
const session = { access_token: 'token', user }
const apiError = new Error('error de Supabase')

describe('auth store', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useAuthStore()
  })

  describe('initAuth', () => {
    it('recupera la sessió activa', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session } })

      await store.initAuth()

      expect(store.session).toEqual(session)
      expect(store.user).toEqual(user)
    })

    it('deixa user a null si no hi ha sessió', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

      await store.initAuth()

      expect(store.session).toBeNull()
      expect(store.user).toBeNull()
    })

    it('actualitza l\'estat quan Supabase notifica un canvi de sessió', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
      await store.initAuth()
      const onChange = supabase.auth.onAuthStateChange.mock.calls[0][0]

      onChange('SIGNED_IN', session)
      expect(store.user).toEqual(user)

      onChange('SIGNED_OUT', null)
      expect(store.session).toBeNull()
      expect(store.user).toBeNull()
    })
  })

  describe('register', () => {
    it('crida signUp i retorna les dades', async () => {
      supabase.auth.signUp.mockResolvedValue({ data: { user }, error: null })

      const data = await store.register('nom@exemple.com', 'contrasenya1')

      expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'nom@exemple.com', password: 'contrasenya1' })
      expect(data).toEqual({ user })
    })

    it('llança l\'error de Supabase', async () => {
      supabase.auth.signUp.mockResolvedValue({ data: {}, error: apiError })

      await expect(store.register('nom@exemple.com', 'contrasenya1')).rejects.toThrow(apiError)
    })
  })

  describe('resend', () => {
    it('reenvia el correu de verificació de registre', async () => {
      supabase.auth.resend.mockResolvedValue({ error: null })

      await store.resend('nom@exemple.com')

      expect(supabase.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'nom@exemple.com' })
    })

    it('llança l\'error de Supabase', async () => {
      supabase.auth.resend.mockResolvedValue({ error: apiError })

      await expect(store.resend('nom@exemple.com')).rejects.toThrow(apiError)
    })
  })

  describe('login', () => {
    it('crida signInWithPassword i retorna les dades', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })

      const data = await store.login('nom@exemple.com', 'contrasenya1')

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'nom@exemple.com', password: 'contrasenya1' })
      expect(data).toEqual({ user, session })
    })

    it('llança l\'error de Supabase', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: apiError })

      await expect(store.login('nom@exemple.com', 'dolenta')).rejects.toThrow(apiError)
    })
  })

  describe('logout', () => {
    beforeEach(() => {
      store.user = user
      store.session = session
    })

    it('tanca la sessió i buida l\'estat', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: null })

      await store.logout()

      expect(store.user).toBeNull()
      expect(store.session).toBeNull()
    })

    it('si Supabase falla, llança l\'error i manté la sessió', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: apiError })

      await expect(store.logout()).rejects.toThrow(apiError)
      expect(store.user).toEqual(user)
    })
  })
})
