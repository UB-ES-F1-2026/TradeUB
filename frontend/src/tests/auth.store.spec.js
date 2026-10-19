import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { supabase } from '../services/supabase'
import { useAuthStore } from '../stores/auth'

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

describe('auth store (recuperació de contrasenya)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('requestPasswordReset crida Supabase amb el redirectTo correcte', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    await useAuthStore().requestPasswordReset('a@b.com')
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('requestPasswordReset no llança error encara que Supabase falli', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: new Error('x') })
    await expect(useAuthStore().requestPasswordReset('a@b.com')).resolves.toBeUndefined()
  })

  it('updatePassword actualitza la contrasenya i tanca la sessió', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
    await useAuthStore().updatePassword('nova1234')
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nova1234' })
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('updatePassword llança error i no tanca sessió si falla', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: new Error('fail') })
    await expect(useAuthStore().updatePassword('nova1234')).rejects.toThrow('fail')
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })
})