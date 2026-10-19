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

const user = { id: 'u1', email: 'nom@exemple.com' }
const session = { access_token: 'token', user }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/register', name: 'register', component: { render: () => null } },
      { path: '/actius', name: 'actius', component: { render: () => null } },
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
