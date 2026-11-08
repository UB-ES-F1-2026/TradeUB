import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Test d'integració de US2.1 i US2.3: App, router i stores reals; només Supabase és fals.
// updateUser fusiona user_metadata com fa Supabase, perquè els stores llegeixin el que acaben de desar
let user
vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(async ({ data }) => {
        user = { ...user, user_metadata: { ...user.user_metadata, ...data } }
        return { data: { user }, error: null }
      }),
    },
  },
}))

import { supabase } from '../../services/supabase'
import App from '../../App.vue'
import router from '../../router'
import { useAuthStore } from '../../stores/auth'

// Les vistes es carreguen amb import(): s'espera que la navegació acabi en comptes de comptar ticks
async function expectRoute(fullPath) {
  await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(fullPath))
  await flushPromises()
}

async function mountAt(path) {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function signedIn() {
  const auth = useAuthStore()
  auth.session = { access_token: 'token', user }
  auth.user = user
}

const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text)

describe('Flux d\'onboarding (US2.1 + US2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    user = { id: 'u1', email: 'nou@exemple.com', user_metadata: {} }
  })

  it('sense sessió, /onboarding porta al login i hi guarda la destinació', async () => {
    await mountAt('/onboarding')

    await expectRoute('/login?redirect=/onboarding')
  })

  it("en iniciar sessió amb l'onboarding pendent redirigeix a /onboarding", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user, session: { access_token: 'token', user } },
      error: null,
    })
    const wrapper = await mountAt('/login')

    await wrapper.find('input[type="email"]').setValue(user.email)
    await wrapper.find('input[type="password"]').setValue('contrasenya1')
    await wrapper.find('form').trigger('submit')

    await expectRoute('/onboarding')
    expect(wrapper.text()).toContain('Benvingut a TradeUB')
    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('0 %')
  })

  it('"Comença" porta al primer pas pendent i, en completar-lo, la barra de progrés avança', async () => {
    signedIn()
    const wrapper = await mountAt('/onboarding')

    const launch = wrapper.find('[data-test="launch"]')
    expect(launch.text()).toBe('Comença')
    await launch.trigger('click')

    await expectRoute('/onboarding/dades-personals')
    expect(wrapper.text()).toContain('Pas 1 de 3')

    await button(wrapper, 'Completa el pas').trigger('click')

    // El pas es desa a Supabase i se salta automàticament al següent pendent
    await expectRoute('/onboarding/questionari-inversor')
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { onboarding: { 'dades-personals': 'completat' } },
    })
    expect(wrapper.text()).toContain('Pas 2 de 3')

    await button(wrapper, 'Torna').trigger('click')

    await expectRoute('/onboarding')
    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('33 %')
    expect(wrapper.findAll('[data-test="step-card"]')[0].text()).toContain('Completat')
    expect(wrapper.find('[data-test="launch"]').text()).toBe('Continua')
  })

  it('respondre les 5 preguntes del qüestionari mostra el perfil calculat', async () => {
    signedIn()
    const wrapper = await mountAt('/questionari')

    const questions = wrapper.findAll('[data-test="question"]')
    expect(questions).toHaveLength(5)
    // L'última opció de cada pregunta és la de més experiència: 10 punts sobre 10
    for (const question of questions) {
      await question.findAll('input[type="radio"]').at(-1).setValue(true)
    }
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { investor_profile: expect.objectContaining({ profile: 'avancat', score: 10 }) },
    })
    expect(wrapper.find('[data-test="result"]').text()).toContain('Avançat')
  })

  // Encara no hi ha cap enllaç entre les dues US: /onboarding/questionari-inversor mostra el
  // contenidor provisional i enviar el qüestionari a /questionari no marca el pas com a completat
  it.todo("el pas 'questionari-inversor' obre el qüestionari i enviar-lo completa el pas")
})
