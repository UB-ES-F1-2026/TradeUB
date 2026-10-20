import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signInWithPassword: vi.fn(),
      mfa: {
        listFactors: vi.fn(),
        enroll: vi.fn(),
        unenroll: vi.fn(),
        challengeAndVerify: vi.fn(),
      },
    },
  },
}))

import { supabase } from '../services/supabase'
import { useAuthStore } from '../stores/auth'

const base64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '')
const jwt = (aal) => `${base64({ alg: 'HS256' })}.${base64({ sub: 'u1', aal })}.signatura`

const verifiedFactor = { id: 'f1', factor_type: 'totp', status: 'verified' }
const pendingFactor = { id: 'f0', factor_type: 'totp', status: 'unverified' }

function makeSession(aal, factors = []) {
  return { access_token: jwt(aal), user: { id: 'u1', factors } }
}

describe('auth store (verificació en dos passos)', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useAuthStore()
  })

  describe('nivell AAL', () => {
    it('sense sessió no hi ha nivell ni segon pas pendent', () => {
      expect(store.aal).toEqual({ currentLevel: null, nextLevel: null })
      expect(store.needsMfa).toBe(false)
    })

    it('sense 2FA activa, una sessió aal1 no necessita el codi', () => {
      store.session = makeSession('aal1')

      expect(store.aal).toEqual({ currentLevel: 'aal1', nextLevel: 'aal1' })
      expect(store.needsMfa).toBe(false)
    })

    it('amb 2FA activa, una sessió aal1 necessita el codi', () => {
      store.session = makeSession('aal1', [verifiedFactor])

      expect(store.aal).toEqual({ currentLevel: 'aal1', nextLevel: 'aal2' })
      expect(store.needsMfa).toBe(true)
    })

    it('un factor sense verificar no activa el segon pas', () => {
      store.session = makeSession('aal1', [pendingFactor])

      expect(store.needsMfa).toBe(false)
    })

    it('amb el codi ja introduït (aal2) no cal res més', () => {
      store.session = makeSession('aal2', [verifiedFactor])

      expect(store.aal.currentLevel).toBe('aal2')
      expect(store.needsMfa).toBe(false)
    })

    it('el login desa la sessió de seguida per saber si cal el segon pas', async () => {
      const session = makeSession('aal1', [verifiedFactor])
      supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: session.user, session }, error: null })

      await store.login('nom@exemple.com', 'contrasenya1')

      expect(store.needsMfa).toBe(true)
    })
  })

  describe('getTotpFactor', () => {
    it('retorna el factor TOTP verificat', async () => {
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })

      expect(await store.getTotpFactor()).toEqual(verifiedFactor)
    })

    it('retorna null si la 2FA no està activa', async () => {
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null })

      expect(await store.getTotpFactor()).toBeNull()
    })
  })

  describe('enrollTotp', () => {
    beforeEach(() => {
      supabase.auth.mfa.unenroll.mockResolvedValue({ data: {}, error: null })
      supabase.auth.mfa.enroll.mockResolvedValue({
        data: { id: 'f2', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SECRET', uri: 'otpauth://...' } },
        error: null,
      })
    })

    it('esborra les activacions a mitges abans de crear el factor', async () => {
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null })

      const result = await store.enrollTotp()

      expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f0' })
      expect(supabase.auth.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', issuer: 'TradeUB' })
      expect(result).toEqual({ factorId: 'f2', qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SECRET' })
    })

    it('no toca els factors verificats', async () => {
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })

      await store.enrollTotp()

      expect(supabase.auth.mfa.unenroll).not.toHaveBeenCalled()
    })

    it('llança l\'error de Supabase', async () => {
      const apiError = new Error('error de Supabase')
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null })
      supabase.auth.mfa.enroll.mockResolvedValue({ data: null, error: apiError })

      await expect(store.enrollTotp()).rejects.toThrow(apiError)
    })
  })

  describe('verifyTotp i verifyMfaLogin', () => {
    it('verifica el codi i actualitza la sessió a aal2', async () => {
      store.session = makeSession('aal1', [verifiedFactor])
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
      supabase.auth.getSession.mockResolvedValue({ data: { session: makeSession('aal2', [verifiedFactor]) } })

      await store.verifyTotp('f1', '123456')

      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
      expect(store.needsMfa).toBe(false)
    })

    it('amb un codi incorrecte llança l\'error i la sessió es queda a aal1', async () => {
      store.session = makeSession('aal1', [verifiedFactor])
      const wrongCode = Object.assign(new Error('Invalid TOTP code entered'), { code: 'mfa_verification_failed' })
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: wrongCode })

      await expect(store.verifyTotp('f1', '000000')).rejects.toThrow(wrongCode)
      expect(store.needsMfa).toBe(true)
    })

    it('el segon pas del login fa servir el factor verificat de l\'usuari', async () => {
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
      supabase.auth.getSession.mockResolvedValue({ data: { session: makeSession('aal2', [verifiedFactor]) } })

      await store.verifyMfaLogin('123456')

      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
    })
  })

  describe('unenrollTotp', () => {
    it('demana el codi abans d\'esborrar el factor', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
      supabase.auth.getSession.mockResolvedValue({ data: { session: makeSession('aal2', [verifiedFactor]) } })
      supabase.auth.mfa.unenroll.mockResolvedValue({ data: {}, error: null })
      supabase.auth.refreshSession.mockResolvedValue({ data: { session: makeSession('aal2') }, error: null })

      await store.unenrollTotp('f1', '123456')

      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
      expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f1' })
      expect(store.session.user.factors).toEqual([])
      expect(store.needsMfa).toBe(false)
    })

    it('amb un codi incorrecte no esborra el factor', async () => {
      const wrongCode = Object.assign(new Error('Invalid TOTP code entered'), { code: 'mfa_verification_failed' })
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: wrongCode })

      await expect(store.unenrollTotp('f1', '000000')).rejects.toThrow(wrongCode)
      expect(supabase.auth.mfa.unenroll).not.toHaveBeenCalled()
    })
  })
})
