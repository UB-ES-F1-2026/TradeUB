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

// API falsa: l'estat de l'onboarding es demana al backend després del login
vi.mock('../services/api', () => ({ apiGet: vi.fn() }))

import { supabase } from '../services/supabase'
import { apiGet } from '../services/api'
import { ONBOARDING_STEPS } from '../stores/onboarding'
import LoginView from '../views/LoginView.vue'

const user = { id: 'u1', email: 'nom@exemple.com' }
const session = { access_token: 'token', user }

// Resposta de GET /users/me amb tots els passos en l'estat indicat
function mockOnboarding(status) {
  apiGet.mockResolvedValue({
    onboarding: { steps: ONBOARDING_STEPS.map((s) => ({ id: s.id, status })) },
  })
}

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

  it("inicia sessió i, amb l'onboarding acabat, redirigeix a /actius", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
    mockOnboarding('completat')
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, '  Nom@Exemple.com ', 'contrasenya1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'nom@exemple.com',
      password: 'contrasenya1',
    })
    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(router.currentRoute.value.path).toBe('/actius')
  })

  it("sense l'onboarding acabat porta a la pantalla de benvinguda", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
    mockOnboarding('pendent')
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, 'nom@exemple.com', 'contrasenya1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it('si el backend no respon porta a la benvinguda sense mostrar error de login', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
    apiGet.mockRejectedValue(new Error('Error de xarxa'))
    const { wrapper, router } = await mountLogin()

    await fill(wrapper, 'nom@exemple.com', 'contrasenya1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/onboarding')
    expect(wrapper.text()).not.toContain("No s'ha pogut iniciar sessió")
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
    // Amb la sessió a aal1 el backend rebutjaria el token: l'estat es demana després del codi
    expect(apiGet).not.toHaveBeenCalled()
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
