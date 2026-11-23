import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  verifyPassword: vi.fn(),
  supabase: {
    auth: {
      getSession: vi.fn(),
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
import PasswordCard from '../components/PasswordCard.vue'

const base64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '')
const jwt = (aal) => `${base64({ alg: 'HS256' })}.${base64({ sub: 'u1', aal })}.signatura`

const verifiedFactor = { id: 'f1', factor_type: 'totp', status: 'verified' }

function makeSession(aal, factors = []) {
  return { access_token: jwt(aal), user: { id: 'u1', email: 'nom@exemple.com', factors } }
}

const authError = (code) => Object.assign(new Error(code), { code })

function login(session) {
  const store = useAuthStore()
  store.session = session
  store.user = session.user
}

function button(wrapper, text) {
  return wrapper.findAll('button').find((b) => b.text() === text)
}

async function openForm() {
  const wrapper = mount(PasswordCard)
  await button(wrapper, 'Canvia la contrasenya').trigger('click')
  return wrapper
}

async function fillAndSubmit(wrapper, { current = 'actual123', next = 'nova12345', confirm = next, code } = {}) {
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue(current)
  await inputs[1].setValue(next)
  await inputs[2].setValue(confirm)
  if (code !== undefined) await inputs[3].setValue(code)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('PasswordCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    verifyPassword.mockResolvedValue()
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null })
  })

  describe('sense 2FA', () => {
    beforeEach(() => {
      login(makeSession('aal1'))
    })

    it('mostra l\'apartat tancat amb el botó de canviar la contrasenya', () => {
      const wrapper = mount(PasswordCard)

      expect(wrapper.text()).toContain('Contrasenya')
      expect(button(wrapper, 'Canvia la contrasenya').exists()).toBe(true)
      expect(wrapper.find('form').exists()).toBe(false)
    })

    it('obre el formulari amb la contrasenya actual, la nova i la repetició, sense el codi', async () => {
      const wrapper = await openForm()

      expect(wrapper.findAll('input')).toHaveLength(3)
      expect(wrapper.text()).toContain('Contrasenya actual')
      expect(wrapper.text()).toContain('Repeteix la contrasenya nova')
      expect(wrapper.text()).not.toContain("Codi d'autenticació")
    })

    it('mostra els mateixos requisits que al registre', async () => {
      const wrapper = await openForm()

      expect(wrapper.text()).toContain('Mínim 8 caràcters')
      expect(wrapper.text()).toContain('Almenys un número')
    })

    it('no envia res si la nova no compleix els requisits', async () => {
      const wrapper = await openForm()
      await fillAndSubmit(wrapper, { next: 'curta' })

      expect(wrapper.text()).toContain('La contrasenya no compleix els requisits.')
      expect(verifyPassword).not.toHaveBeenCalled()
    })

    it('no envia res si la repetició no coincideix', async () => {
      const wrapper = await openForm()
      await fillAndSubmit(wrapper, { confirm: 'altra12345' })

      expect(wrapper.text()).toContain('Les contrasenyes no coincideixen.')
      expect(verifyPassword).not.toHaveBeenCalled()
    })

    it('no envia res si la nova és igual que l\'actual', async () => {
      const wrapper = await openForm()
      await fillAndSubmit(wrapper, { current: 'mateixa123', next: 'mateixa123' })

      expect(wrapper.text()).toContain("La contrasenya nova ha de ser diferent de l'anterior.")
      expect(verifyPassword).not.toHaveBeenCalled()
    })

    it('si la contrasenya actual és incorrecta, mostra l\'error i no la canvia', async () => {
      verifyPassword.mockRejectedValue(authError('invalid_credentials'))
      const wrapper = await openForm()
      await fillAndSubmit(wrapper, { current: 'dolenta1' })

      expect(wrapper.text()).toContain('La contrasenya actual és incorrecta.')
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
      expect(wrapper.find('form').exists()).toBe(true)
    })

    it('en desar-la, tanca el formulari i mostra la confirmació', async () => {
      const wrapper = await openForm()
      await fillAndSubmit(wrapper)

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nova12345' })
      expect(wrapper.find('form').exists()).toBe(false)
      expect(wrapper.text()).toContain("S'ha canviat la contrasenya.")
    })

    it('cancel·lar tanca el formulari sense canviar res', async () => {
      const wrapper = await openForm()
      await button(wrapper, 'Cancel·la').trigger('click')

      expect(wrapper.find('form').exists()).toBe(false)
      expect(verifyPassword).not.toHaveBeenCalled()
    })
  })

  describe('amb la 2FA activa', () => {
    beforeEach(() => {
      login(makeSession('aal2', [verifiedFactor]))
      supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })
      supabase.auth.getSession.mockResolvedValue({ data: { session: makeSession('aal2', [verifiedFactor]) } })
    })

    it('també demana el codi d\'autenticació', async () => {
      const wrapper = await openForm()

      expect(wrapper.findAll('input')).toHaveLength(4)
      expect(wrapper.text()).toContain("Codi d'autenticació")
    })

    it('no envia res sense un codi de 6 dígits', async () => {
      const wrapper = await openForm()
      await fillAndSubmit(wrapper, { code: '12' })

      expect(wrapper.text()).toContain('Introdueix el codi de 6 dígits.')
      expect(verifyPassword).not.toHaveBeenCalled()
    })

    it('amb un codi incorrecte mostra l\'error i no la canvia', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: authError('mfa_verification_failed') })
      const wrapper = await openForm()
      await fillAndSubmit(wrapper, { code: '000000' })

      expect(wrapper.text()).toContain("El codi d'autenticació és incorrecte.")
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('amb el codi correcte desa la nova contrasenya', async () => {
      supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
      const wrapper = await openForm()
      await fillAndSubmit(wrapper, { code: '123 456' })

      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nova12345' })
      expect(wrapper.text()).toContain("S'ha canviat la contrasenya.")
    })
  })
})
