import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  verifyPassword: vi.fn(),
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      mfa: {
        listFactors: vi.fn(),
        challengeAndVerify: vi.fn(),
      },
    },
  },
}))

import { supabase, verifyPassword } from '../services/supabase'
import { useAuthStore } from '../stores/auth'

const base64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '')
const jwt = (aal) => `${base64({ alg: 'HS256' })}.${base64({ sub: 'u1', aal })}.signatura`

const verifiedFactor = { id: 'f1', factor_type: 'totp', status: 'verified' }

function makeSession(aal, factors = []) {
  return { access_token: jwt(aal), user: { id: 'u1', email: 'nom@exemple.com', factors } }
}

const authError = (code) => Object.assign(new Error(code), { code })

describe('auth store (canvi de contrasenya)', () => {
  let store

  function login(session) {
    store.session = session
    store.user = session.user
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useAuthStore()
    verifyPassword.mockResolvedValue()
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null })
  })

  describe('sense 2FA', () => {
    beforeEach(() => login(makeSession('aal1')))

    it('comprova la contrasenya actual i desa la nova sense tancar la sessió', async () => {
      await store.changePassword('actual123', 'nova12345')

      expect(verifyPassword).toHaveBeenCalledWith('nom@exemple.com', 'actual123')
      expect(supabase.auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nova12345' })
      expect(supabase.auth.signOut).not.toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(true)
    })

    it('comprova la contrasenya actual sense iniciar sessió amb el client principal', async () => {
      await store.changePassword('actual123', 'nova12345')

      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    })

    it('amb la contrasenya actual incorrecta no la canvia', async () => {
      verifyPassword.mockRejectedValue(authError('invalid_credentials'))

      await expect(store.changePassword('dolenta1', 'nova12345')).rejects.toMatchObject({ code: 'invalid_credentials' })
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('propaga l\'error de Supabase si la nova és igual a l\'actual', async () => {
      supabase.auth.updateUser.mockResolvedValue({ data: {}, error: authError('same_password') })

      await expect(store.changePassword('actual123', 'actual123')).rejects.toMatchObject({ code: 'same_password' })
    })
  })

  describe('amb la 2FA activa', () => {
    beforeEach(() => {
      login(makeSession('aal2', [verifiedFactor]))
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })
      supabase.auth.getSession.mockResolvedValue({ data: { session: makeSession('aal2', [verifiedFactor]) } })
    })

    it('verifica el codi abans de desar la nova i la sessió es queda a aal2', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })

      await store.changePassword('actual123', 'nova12345', '123456')

      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nova12345' })
      expect(store.aal.currentLevel).toBe('aal2')
    })

    it('amb un codi incorrecte no la canvia i la sessió es queda a aal2', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: authError('mfa_verification_failed') })

      await expect(store.changePassword('actual123', 'nova12345', '000000')).rejects.toMatchObject({ code: 'mfa_verification_failed' })
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
      expect(store.aal.currentLevel).toBe('aal2')
      expect(store.needsMfa).toBe(false)
    })

    it('amb la contrasenya actual incorrecta no comprova el codi', async () => {
      verifyPassword.mockRejectedValue(authError('invalid_credentials'))

      await expect(store.changePassword('dolenta1', 'nova12345', '123456')).rejects.toMatchObject({ code: 'invalid_credentials' })
      expect(supabase.auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })
  })
})
