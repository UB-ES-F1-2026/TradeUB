import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Test d'integració de US2.1 i US2.3: App, router i stores reals. Només es simulen les dues fronteres
// externes: Supabase (sessió) i el backend (GET /users/me, d'on surt l'estat de l'onboarding des de la #67)
vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}))

import { supabase } from '../../services/supabase'
import App from '../../App.vue'
import router from '../../router'
import { useAuthStore } from '../../stores/auth'
import { ONBOARDING_STEPS } from '../../stores/onboarding'

const user = { id: 'u1', email: 'nou@exemple.com', user_metadata: {} }
const session = { access_token: 'token', user }

// Backend fals: els passos que el servidor dona per completats
let completed
const fetchMock = vi.fn(async (url) => {
  if (!String(url).endsWith('/users/me')) throw new Error(`Crida no esperada: ${url}`)
  const steps = ONBOARDING_STEPS.map((s) => ({ id: s.id, status: completed.has(s.id) ? 'completat' : 'pendent' }))
  return { ok: true, status: 200, json: async () => ({ onboarding: { steps } }) }
})

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
  auth.session = session
  auth.user = user
  supabase.auth.getSession.mockResolvedValue({ data: { session } })
}

const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text)

describe('Flux d\'onboarding (US2.1 + US2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    completed = new Set()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('sense sessió, /onboarding porta al login i hi guarda la destinació', async () => {
    await mountAt('/onboarding')

    await expectRoute('/login?redirect=/onboarding')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("en iniciar sessió amb l'onboarding pendent redirigeix a /onboarding", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
    const wrapper = await mountAt('/login')

    await wrapper.find('input[type="email"]').setValue(user.email)
    await wrapper.find('input[type="password"]').setValue('contrasenya1')
    await wrapper.find('form').trigger('submit')

    await expectRoute('/onboarding')
    // L'estat es demana al backend amb el token de la sessió
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users/me'),
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } })
    )
    expect(wrapper.text()).toContain('Benvingut a TradeUB')
    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('0 %')
  })

  it('"Comença" porta al primer pas pendent i, quan el backend el dona per fet, la barra de progrés avança', async () => {
    signedIn()
    const wrapper = await mountAt('/onboarding')

    const launch = wrapper.find('[data-test="launch"]')
    expect(launch.text()).toBe('Comença')
    await launch.trigger('click')

    await expectRoute('/onboarding/dades-personals')
    expect(wrapper.text()).toContain('Pas 1 de 3')

    // El pas el completa el backend en rebre el formulari (US2.2); aquí se simula que ja ho ha fet
    completed.add('dades-personals')
    await button(wrapper, 'Completa el pas').trigger('click')

    // Es torna a demanar l'estat i se salta al següent pas pendent
    await expectRoute('/onboarding/questionari-inversor')
    expect(wrapper.text()).toContain('Pas 2 de 3')

    await button(wrapper, 'Torna').trigger('click')

    await expectRoute('/onboarding')
    await vi.waitFor(() => expect(wrapper.find('[data-test="progress-value"]').text()).toBe('33 %'))
    expect(wrapper.findAll('[data-test="step-card"]')[0].text()).toContain('Completat')
    expect(wrapper.find('[data-test="launch"]').text()).toBe('Continua')
  })

  it('si el backend no respon, la benvinguda avisa i deixa tots els passos pendents', async () => {
    signedIn()
    fetchMock.mockRejectedValueOnce(new Error('Error de xarxa'))
    const wrapper = await mountAt('/onboarding')

    await vi.waitFor(() => expect(wrapper.text()).toContain("No s'ha pogut carregar el teu progrés"))
    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('0 %')
  })

  // Pendent de #69 (endpoint del qüestionari) i #82 (el pas obre el qüestionari i l'envia al backend):
  // des de la #67 el frontend ja no pot completar el pas des de user_metadata
  it.todo("respondre les 5 preguntes al pas 'questionari-inversor' desa el perfil al backend i completa el pas")
})
