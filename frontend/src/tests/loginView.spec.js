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
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}))

import { supabase } from '../services/supabase'
import LoginView from '../views/LoginView.vue'

// Usuari que ja ha acabat l'onboarding (si no, el login el porta a la benvinguda)
const onboardingDone = {
  'dades-personals': 'completat',
  'questionari-inversor': 'completat',
  'verificacio-identitat': 'completat',
}
const user = { id: 'u1', email: 'nom@exemple.com', user_metadata: { onboarding: onboardingDone } }
const session = { access_token: 'token', user }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/register', name: 'register', component: { render: () => null } },
      { path: '/actius', name: 'actius', component: { render: () => null } },
      { path: '/forgot-password', name: 'forgot-password', component: { render: () => null } },
      { path: '/mfa', name: 'mfa', component: { render: () => null } },
      { path: '/onboarding', name: 'onboarding', component: { render: () => null } },
    ],
  })
}

async function mountLogin() {
  const router = makeRouter()
  router.push('/login')
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function fill(wrapper, email, password) {
  await wrapper.find('input[type="email"]').setValue(email)
  await wrapper.find('input[type="password"]').setValue(password)
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('no envia el formulari si els camps són buits', async () => {
    const { wrapper } = await mountLogin()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Introdueix un correu vàlid.')
    expect(wrapper.text()).toContain('Introdueix la contrasenya.')
  })

  it('inicia sessió i redirigeix a /actius', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, '  Nom@Exemple.com ', 'contrasenya1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'nom@exemple.com',
      password: 'contrasenya1',
    })
    expect(router.currentRoute.value.path).toBe('/actius')
  })

  it("sense l'onboarding acabat porta a la pantalla de benvinguda", async () => {
    const newUser = { id: 'u2', email: 'nou@exemple.com', user_metadata: {} }
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: newUser, session: { access_token: 'token', user: newUser } },
      error: null,
    })
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, 'nou@exemple.com', 'contrasenya1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it("amb la 2FA activa demana el codi abans d'entrar", async () => {
    // Token aal1 (només contrasenya) d'un usuari amb un factor TOTP verificat
    const payload = btoa(JSON.stringify({ sub: 'u1', aal: 'aal1' }))
    const mfaUser = { ...user, factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] }
    const mfaSession = { access_token: `header.${payload}.signatura`, user: mfaUser }
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: mfaUser, session: mfaSession }, error: null })
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, 'nom@exemple.com', 'contrasenya1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/mfa?redirect=/actius')
  })

  it('enllaça a la recuperació de contrasenya', async () => {
    const { wrapper } = await mountLogin()

    const link = wrapper.findAll('a').find((a) => a.text() === 'Has oblidat la contrasenya?')
    expect(link?.attributes('href')).toBe('/forgot-password')
  })

  it('mostra un missatge en català si les credencials són incorrectes', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials' },
    })
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, 'nom@exemple.com', 'dolenta')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Correu o contrasenya incorrectes.')
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
