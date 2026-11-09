import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost } from '../services/api'
import { acceptTerms, canOperate, fetchVerification, isIdentityVerified } from '../services/verification'

describe('servei de verificació', () => {
  beforeEach(() => vi.clearAllMocks())

  it('llegeix el camp verificacio de /users/me', async () => {
    apiGet.mockResolvedValue({ verificacio: { estat: 'verificat' } })

    expect(await fetchVerification()).toEqual({ estat: 'verificat' })
    expect(apiGet).toHaveBeenCalledWith('/users/me')
  })

  it('retorna null si el backend encara no retorna la verificació', async () => {
    apiGet.mockResolvedValue({ perfil: {} })

    expect(await fetchVerification()).toBeNull()
  })

  it('envia la versió dels termes al backend', async () => {
    apiPost.mockResolvedValue({ verificacio: { termes_acceptats: true } })

    expect(await acceptTerms('2026-11')).toEqual({ termes_acceptats: true })
    expect(apiPost).toHaveBeenCalledWith('/profile/terms', { versio: '2026-11' })
  })

  it('només es pot operar amb la identitat verificada i els termes acceptats', () => {
    expect(canOperate({ estat: 'verificat', termes_acceptats: true })).toBe(true)
    expect(canOperate({ estat: 'verificat', termes_acceptats: false })).toBe(false)
    expect(canOperate({ estat: 'en-revisio', termes_acceptats: true })).toBe(false)
    expect(canOperate(null)).toBe(false)
    expect(isIdentityVerified({ estat: 'verificat' })).toBe(true)
    expect(isIdentityVerified({ estat: 'pendent' })).toBe(false)
  })
})
