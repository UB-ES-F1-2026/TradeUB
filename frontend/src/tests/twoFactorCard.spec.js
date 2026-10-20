import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
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
import TwoFactorCard from '../components/TwoFactorCard.vue'

const verifiedFactor = { id: 'f1', factor_type: 'totp', status: 'verified' }
const wrongCode = { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' }

function listFactors(factors) {
  supabase.auth.mfa.listFactors.mockResolvedValue({
    data: { all: factors, totp: factors.filter((f) => f.status === 'verified') },
    error: null,
  })
}

async function mountCard() {
  const wrapper = mount(TwoFactorCard)
  await flushPromises()
  return wrapper
}

function button(wrapper, text) {
  return wrapper.findAll('button').find((b) => b.text() === text)
}

async function submitCode(wrapper, code) {
  await wrapper.find('input').setValue(code)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('TwoFactorCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token', user: { id: 'u1' } } } })
  })

  describe('2FA inactiva', () => {
    beforeEach(() => {
      listFactors([])
      supabase.auth.mfa.enroll.mockResolvedValue({
        data: { id: 'f2', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://...' } },
        error: null,
      })
    })

    it('mostra l\'estat inactiu i el botó d\'activar', async () => {
      const wrapper = await mountCard()

      expect(wrapper.text()).toContain('Inactiva')
      expect(button(wrapper, 'Activar')).toBeTruthy()
    })

    it('en activar mostra el QR i la clau', async () => {
      const wrapper = await mountCard()

      await button(wrapper, 'Activar').trigger('click')
      await flushPromises()

      expect(wrapper.find('img').attributes('src')).toBe('data:image/svg+xml;utf-8,<svg/>')
      expect(wrapper.text()).toContain('JBSWY3DPEHPK3PXP')
    })

    it('amb el codi correcte queda activada', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
      const wrapper = await mountCard()
      await button(wrapper, 'Activar').trigger('click')
      await flushPromises()

      await submitCode(wrapper, '123456')

      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f2', code: '123456' })
      expect(wrapper.text()).toContain('Activa')
      expect(wrapper.text()).toContain('Verificació en dos passos activada.')
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('amb un codi incorrecte mostra l\'error i no l\'activa', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: wrongCode })
      const wrapper = await mountCard()
      await button(wrapper, 'Activar').trigger('click')
      await flushPromises()

      await submitCode(wrapper, '000000')

      expect(wrapper.text()).toContain("El codi d'autenticació és incorrecte.")
      expect(wrapper.text()).toContain('Inactiva')
      expect(wrapper.find('img').exists()).toBe(true)
    })

    it('cancel·lar torna a l\'estat inicial', async () => {
      const wrapper = await mountCard()
      await button(wrapper, 'Activar').trigger('click')
      await flushPromises()

      await button(wrapper, 'Cancel·lar').trigger('click')

      expect(wrapper.find('img').exists()).toBe(false)
      expect(button(wrapper, 'Activar')).toBeTruthy()
    })
  })

  describe('2FA activa', () => {
    beforeEach(() => listFactors([verifiedFactor]))

    it('mostra l\'estat actiu i el botó de desactivar', async () => {
      const wrapper = await mountCard()

      expect(wrapper.text()).toContain('Activa')
      expect(button(wrapper, 'Desactivar')).toBeTruthy()
    })

    it('per desactivar demana el codi i després esborra el factor', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
      supabase.auth.mfa.unenroll.mockResolvedValue({ data: {}, error: null })
      supabase.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: null })
      const wrapper = await mountCard()

      await button(wrapper, 'Desactivar').trigger('click')
      expect(supabase.auth.mfa.unenroll).not.toHaveBeenCalled()
      await submitCode(wrapper, '123456')

      expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f1' })
      expect(wrapper.text()).toContain('Inactiva')
      expect(wrapper.text()).toContain('Verificació en dos passos desactivada.')
    })

    it('amb un codi incorrecte no la desactiva', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: wrongCode })
      const wrapper = await mountCard()

      await button(wrapper, 'Desactivar').trigger('click')
      await submitCode(wrapper, '000000')

      expect(supabase.auth.mfa.unenroll).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain("El codi d'autenticació és incorrecte.")
    })
  })
})
