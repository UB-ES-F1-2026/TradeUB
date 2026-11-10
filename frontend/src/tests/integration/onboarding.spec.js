import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Test d'integració de US2.1, US2.2 i US2.3: App, router i stores reals. Només es simulen les dues fronteres
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
import { INVESTOR_QUESTIONS } from '../../utils/investorQuestions'

const user = { id: 'u1', email: 'nou@exemple.com', user_metadata: {} }
const session = { access_token: 'token', user }

// Backend fals: els passos que el servidor dona per completats
let completed
const fetchMock = vi.fn(async (url, init = {}) => {
  // Com el backend real: desar cada formulari completa el seu pas
  if (String(url).endsWith('/profile/personal-data') && init.method === 'POST') {
    completed.add('dades-personals')
    return { ok: true, status: 200, json: async () => ({ perfil: JSON.parse(init.body) }) }
  }
  if (String(url).endsWith('/profile/investor-questionnaire') && init.method === 'POST') {
    completed.add('questionari-inversor')
    return { ok: true, status: 200, json: async () => ({ profile: 'intermedi' }) }
  }
  if (!String(url).endsWith('/users/me')) throw new Error(`Crida no esperada: ${url}`)
  const steps = ONBOARDING_STEPS.map((s) => ({ id: s.id, status: completed.has(s.id) ? 'completat' : 'pendent' }))
  return { ok: true, status: 200, json: async () => ({ onboarding: { steps }, perfil: {} }) }
})

// Les vistes es carreguen amb import(): s'espera que la navegació acabi en comptes de comptar ticks
async function expectRoute(fullPath) {
  await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(fullPath))
  await flushPromises()
}

// El router és compartit entre tests: cada App es desmunta perquè no reaccioni a les navegacions del següent
let wrapper
async function mountAt(path) {
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router] } })
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

// Cada camp del formulari és un .ui-field amb la seva etiqueta
const field = (wrapper, label) => wrapper.findAll('.ui-field').find((f) => f.find('label').text() === label)

// Dades simulades: el NIF només ha de passar la validació de format
const personalData = {
  Nom: 'Usuari',
  Cognoms: 'De Prova',
  'Data de naixement': '1999-05-17',
  Telèfon: '600000000',
  'NIF/NIE': '12345678z',
  'Carrer i número': 'Carrer de Prova 1',
  'Codi postal': '08007',
  Població: 'Barcelona',
}

describe('Flux d\'onboarding (US2.1 + US2.2 + US2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    completed = new Set()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
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

  it('"Comença" porta a les dades personals i, en desar-les, al qüestionari', async () => {
    signedIn()
    const wrapper = await mountAt('/onboarding')

    const launch = wrapper.find('[data-test="launch"]')
    expect(launch.text()).toBe('Comença')
    await launch.trigger('click')

    await expectRoute('/onboarding/dades-personals')
    expect(wrapper.text()).toContain('Pas 1 de 3')

    for (const [label, value] of Object.entries(personalData)) {
      await field(wrapper, label).find('input').setValue(value)
    }
    await field(wrapper, 'País de residència fiscal').find('select').setValue('ES')
    await wrapper.find('form').trigger('submit')

    // El backend rep les dades i dona el pas per fet; el formulari salta al següent pas pendent
    await expectRoute('/onboarding/questionari-inversor')
    expect(wrapper.text()).toContain('Pas 2 de 3')
    const [, init] = fetchMock.mock.calls.find(([url]) => url.endsWith('/profile/personal-data'))
    expect(JSON.parse(init.body)).toMatchObject({ nom: 'Usuari', nif: '12345678Z', residencia_fiscal: 'ES' })

    // El pas del qüestionari no té botó per tornar: la benvinguda es torna a obrir des del router
    await router.push('/onboarding')
    await expectRoute('/onboarding')
    await vi.waitFor(() => expect(wrapper.find('[data-test="progress-value"]').text()).toBe('33 %'))
    expect(wrapper.findAll('[data-test="step-card"]')[0].text()).toContain('Completat')
  })

  it("respondre les 5 preguntes desa el perfil al backend, el mostra i la barra de progrés avança", async () => {
    // Les dades personals ja es proven al test anterior: aquí el backend ja les dona per fetes
    completed.add('dades-personals')
    signedIn()
    const wrapper = await mountAt('/onboarding')

    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('33 %')
    const launch = wrapper.find('[data-test="launch"]')
    expect(launch.text()).toBe('Continua')
    await launch.trigger('click')

    await expectRoute('/onboarding/questionari-inversor')
    expect(wrapper.text()).toContain('Pas 2 de 3')
    expect(wrapper.findAll('[data-test="question"]')).toHaveLength(INVESTOR_QUESTIONS.length)

    for (const question of INVESTOR_QUESTIONS) {
      await wrapper.find(`input[name="${question.id}"][value="${question.options[1].id}"]`).setValue()
    }
    expect(wrapper.find('[data-test="answered-count"]').text()).toBe('5 de 5 respostes')
    await wrapper.find('form').trigger('submit')

    // Les respostes van al backend, i el perfil que retorna és el que es mostra
    await vi.waitFor(() => expect(wrapper.find('[data-test="result"]').text()).toContain('Intermedi'))
    const [, init] = fetchMock.mock.calls.find(([url]) => url.endsWith('/profile/investor-questionnaire'))
    expect(JSON.parse(init.body)).toEqual(
      Object.fromEntries(INVESTOR_QUESTIONS.map((q) => [q.id, q.options[1].id]))
    )

    // En continuar es torna a demanar l'estat: el pas ja surt completat i se salta al següent
    await button(wrapper, 'Continua').trigger('click')
    await expectRoute('/onboarding/verificacio-identitat')
    expect(wrapper.text()).toContain('Pas 3 de 3')

    await button(wrapper, 'Torna').trigger('click')
    await expectRoute('/onboarding')
    await vi.waitFor(() => expect(wrapper.find('[data-test="progress-value"]').text()).toBe('67 %'))
    expect(wrapper.findAll('[data-test="step-card"]')[1].text()).toContain('Completat')
  })

  it('si el backend no respon, la benvinguda avisa i deixa tots els passos pendents', async () => {
    signedIn()
    fetchMock.mockRejectedValueOnce(new Error('Error de xarxa'))
    const wrapper = await mountAt('/onboarding')

    await vi.waitFor(() => expect(wrapper.text()).toContain("No s'ha pogut carregar el teu progrés"))
    expect(wrapper.find('[data-test="progress-value"]').text()).toBe('0 %')
  })
})
