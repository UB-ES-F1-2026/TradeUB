import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signOut: vi.fn(),
      mfa: {
        listFactors: vi.fn(),
        challengeAndVerify: vi.fn(),
      },
    },
  },
}))

import { supabase } from '../services/supabase'
import { useAuthStore } from '../stores/auth'
import MfaVerifyView from '../views/MfaVerifyView.vue'

const verifiedFactor = { id: 'f1', factor_type: 'totp', status: 'verified' }
// Usuari que ja ha acabat l'onboarding (si no, després del codi va a la benvinguda)
const onboardingDone = {
  'dades-personals': 'completat',
  'questionari-inversor': 'completat',
  'verificacio-identitat': 'completat',
}
const session = {
  access_token: 'token',
  user: { id: 'u1', factors: [verifiedFactor], user_metadata: { onboarding: onboardingDone } },
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/mfa', name: 'mfa', component: MfaVerifyView },
      { path: '/login', name: 'login', component: { render: () => null } },
      { path: '/actius', name: 'actius', component: { render: () => null } },
      { path: '/perfil', name: 'perfil', component: { render: () => null } },
      { path: '/onboarding', name: 'onboarding', component: { render: () => null } },
    ],
  })
}

async function mountMfa(path = '/mfa') {
  const router = makeRouter()
  router.push(path)
  await router.isReady()
  const wrapper = mount(MfaVerifyView, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function submitCode(wrapper, code) {
  await wrapper.find('input').setValue(code)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('MfaVerifyView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useAuthStore().session = session
    supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null })
    supabase.auth.getSession.mockResolvedValue({ data: { session } })
  })

  it('no envia el codi si no té 6 xifres', async () => {
    const { wrapper } = await mountMfa()

    await submitCode(wrapper, '12a')

    expect(supabase.auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Introdueix el codi de 6 dígits.')
  })

  it('amb el codi correcte va a la ruta guardada', async () => {
    supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    const { wrapper, router } = await mountMfa('/mfa?redirect=/perfil')

    await submitCode(wrapper, '123 456')

    expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
    expect(router.currentRoute.value.path).toBe('/perfil')
  })

  it('sense ruta guardada va a /actius', async () => {
    supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    const { wrapper, router } = await mountMfa()

    await submitCode(wrapper, '123456')

    expect(router.currentRoute.value.path).toBe('/actius')
  })

  it("sense l'onboarding acabat va a la pantalla de benvinguda", async () => {
    const newSession = { access_token: 'token', user: { id: 'u2', factors: [verifiedFactor], user_metadata: {} } }
    supabase.auth.getSession.mockResolvedValue({ data: { session: newSession } })
    supabase.auth.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    const { wrapper, router } = await mountMfa('/mfa?redirect=/perfil')

    await submitCode(wrapper, '123456')

    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it('amb un codi incorrecte mostra l\'error i es queda a /mfa', async () => {
    supabase.auth.mfa.challengeAndVerify.mockResolvedValue({
      data: null,
      error: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' },
    })
    const { wrapper, router } = await mountMfa()

    await submitCode(wrapper, '000000')

    expect(wrapper.text()).toContain("El codi d'autenticació és incorrecte.")
    expect(router.currentRoute.value.path).toBe('/mfa')
  })

  it('cancel·lar tanca la sessió i torna al login', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null })
    const { wrapper, router } = await mountMfa()

    const button = wrapper.findAll('button').find((b) => b.text() === 'Cancel·lar')
    await button.trigger('click')
    await flushPromises()

    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(useAuthStore().session).toBeNull()
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
