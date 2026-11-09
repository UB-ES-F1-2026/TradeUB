import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ONBOARDING_STEPS } from '../stores/onboarding'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
// Supabase i API falsos: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost, ApiError } from '../services/api'
import TermsView from '../views/TermsView.vue'

// jsdom no té IntersectionObserver: el doble guarda els observadors per simular que el final del text es veu
let observers
class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.disconnected = false
    observers.push(this)
  }
  observe(target) { this.target = target }
  disconnect() { this.disconnected = true }
}

function scrollToEnd() {
  observers
    .filter((o) => !o.disconnected)
    .forEach((o) => o.callback([{ isIntersecting: true, target: o.target }]))
}

const VERIFIED = { estat: 'verificat', termes_versio_vigent: '2026-11', termes_acceptats: false }

// Resposta de GET /users/me: estat de la verificació i passos de l'onboarding (completats o no)
function usersMe(verificacio, completed = false) {
  return {
    verificacio,
    onboarding: {
      steps: ONBOARDING_STEPS.map((s) => ({ id: s.id, status: completed ? 'completat' : 'pendent' })),
    },
  }
}

async function mountTerms() {
  const blank = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/onboarding', name: 'onboarding', component: blank },
      { path: '/onboarding/:step', name: 'onboarding-step', component: blank },
      { path: '/onboarding/verificacio-identitat/termes', name: 'onboarding-termes', component: TermsView },
    ],
  })
  router.push('/onboarding/verificacio-identitat/termes')
  await router.isReady()
  const wrapper = mount(TermsView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

const checkbox = (wrapper) => wrapper.get('[data-test="terms-checkbox"]')
const submitButton = (wrapper) => wrapper.get('[data-test="terms-submit"]')

describe('TermsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    observers = []
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    apiGet.mockResolvedValue(usersMe(VERIFIED))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra els termes amb la casella i el botó desactivats', async () => {
    const { wrapper } = await mountTerms()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(wrapper.text()).toContain('Termes i condicions')
    expect(wrapper.text()).toContain('Versió 2026-11')
    expect(wrapper.get('[data-test="terms-box"]').text()).toContain('projecte acadèmic')
    expect(checkbox(wrapper).attributes('disabled')).toBeDefined()
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Arriba al final del text')
  })

  it('observa el final del text dins la caixa dels termes', async () => {
    const { wrapper } = await mountTerms()

    expect(observers).toHaveLength(1)
    expect(observers[0].target).toBe(wrapper.get('[data-test="terms-end"]').element)
    expect(observers[0].options.root).toBe(wrapper.get('[data-test="terms-box"]').element)
  })

  it('activa la casella en arribar al final del text', async () => {
    const { wrapper } = await mountTerms()

    scrollToEnd()
    await flushPromises()

    expect(checkbox(wrapper).attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Arriba al final del text')
    expect(observers[0].disconnected).toBe(true)
  })

  it('no activa el botó fins que es marca la casella', async () => {
    const { wrapper } = await mountTerms()

    scrollToEnd()
    await flushPromises()
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()

    await checkbox(wrapper).setValue(true)
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('accepta la versió vigent i torna a la benvinguda si ja no queden passos', async () => {
    apiPost.mockResolvedValue({ verificacio: { ...VERIFIED, termes_acceptats: true } })
    const { wrapper, router } = await mountTerms()
    apiGet.mockResolvedValue(usersMe({ ...VERIFIED, termes_acceptats: true }, true))

    scrollToEnd()
    await flushPromises()
    await checkbox(wrapper).setValue(true)
    await submitButton(wrapper).trigger('click')
    await flushPromises()

    expect(apiPost).toHaveBeenCalledWith('/profile/terms', { versio: '2026-11' })
    expect(router.currentRoute.value.name).toBe('onboarding')
  })

  it("després d'acceptar va al següent pas pendent", async () => {
    apiPost.mockResolvedValue({ verificacio: { ...VERIFIED, termes_acceptats: true } })
    const { wrapper, router } = await mountTerms()

    scrollToEnd()
    await flushPromises()
    await checkbox(wrapper).setValue(true)
    await submitButton(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/dades-personals')
  })

  it("mostra el missatge del backend si rebutja l'acceptació", async () => {
    apiPost.mockRejectedValue(new ApiError(409, 'Cal acceptar la versió vigent dels termes'))
    const { wrapper, router } = await mountTerms()

    scrollToEnd()
    await flushPromises()
    await checkbox(wrapper).setValue(true)
    await submitButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Cal acceptar la versió vigent dels termes')
    expect(router.currentRoute.value.name).toBe('onboarding-termes')
  })

  it('mostra un error genèric si falla la xarxa', async () => {
    apiPost.mockRejectedValue(new Error('xarxa'))
    const { wrapper } = await mountTerms()

    scrollToEnd()
    await flushPromises()
    await checkbox(wrapper).setValue(true)
    await submitButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("No s'han pogut acceptar els termes")
  })

  it('torna al pas del DNI si la identitat encara no està verificada', async () => {
    apiGet.mockResolvedValue(usersMe({ estat: 'en-revisio', termes_acceptats: false }))
    const { router } = await mountTerms()

    expect(router.currentRoute.value.fullPath).toBe('/onboarding/verificacio-identitat')
  })

  it('surt de la pantalla si els termes vigents ja estan acceptats', async () => {
    apiGet.mockResolvedValue(usersMe({ ...VERIFIED, termes_acceptats: true }, true))
    const { router } = await mountTerms()

    expect(apiPost).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('onboarding')
  })

  it("si no es pot comprovar l'estat, mostra l'error i ho deixa tornar a provar", async () => {
    apiGet.mockRejectedValueOnce(new Error('xarxa'))
    const { wrapper } = await mountTerms()

    expect(wrapper.text()).toContain("No s'ha pogut comprovar l'estat de la verificació")
    expect(wrapper.find('[data-test="terms-box"]').exists()).toBe(false)

    await wrapper.findAll('button').find((b) => b.text() === 'Torna-ho a provar').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="terms-box"]').exists()).toBe(true)
  })
})
