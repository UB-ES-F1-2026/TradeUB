import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

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
import IdentityDocumentUpload from '../components/IdentityDocumentUpload.vue'

const NOW = new Date('2026-11-09T10:00:00Z')

const withStatus = (estat) => ({
  verificacio: { estat, document_enviat_at: estat === 'pendent' ? null : NOW.toISOString() },
})

async function mountUpload(estat = 'pendent') {
  apiGet.mockResolvedValue(withStatus(estat))
  const wrapper = mount(IdentityDocumentUpload)
  await flushPromises()
  return wrapper
}

// jsdom no deixa assignar fitxers a un input: es defineix la propietat i es dispara el change
async function selectFile(wrapper, name, type) {
  const input = wrapper.get('[data-test="dni-input"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['x'], name, { type })], configurable: true })
  await input.trigger('change')
}

const submitButton = (wrapper) => wrapper.get('[data-test="dni-submit"]')

describe('IdentityDocumentUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.clearAllMocks()
    setActivePinia(createPinia())
    // jsdom no implementa les URL d'objectes per previsualitzar la imatge
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra el selector amb l\'estat pendent i el botó desactivat', async () => {
    const wrapper = await mountUpload()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(wrapper.get('[data-test="dni-status"]').text()).toBe('Pendent')
    expect(wrapper.get('[data-test="dni-input"]').attributes('accept')).toContain('.jpg')
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('rebutja un fitxer que no és JPG ni PNG', async () => {
    const wrapper = await mountUpload()

    await selectFile(wrapper, 'dni.pdf', 'application/pdf')

    expect(wrapper.text()).toContain("Només s'accepten imatges JPG o PNG.")
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="dni-preview"]').exists()).toBe(false)
  })

  it('amb una imatge vàlida en mostra la previsualització i activa el botó', async () => {
    const wrapper = await mountUpload()
    await selectFile(wrapper, 'dni.pdf', 'application/pdf')

    await selectFile(wrapper, 'dni.png', 'image/png')

    expect(wrapper.text()).not.toContain("Només s'accepten imatges JPG o PNG.")
    expect(wrapper.text()).toContain('dni.png')
    expect(wrapper.get('[data-test="dni-preview"]').attributes('src')).toBe('blob:preview')
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('en enviar mostra el compte enrere i, en acabar, l\'estat verificat', async () => {
    const wrapper = await mountUpload()
    await selectFile(wrapper, 'dni.jpg', 'image/jpeg')
    apiPost.mockResolvedValue(withStatus('en-revisio'))
    apiGet.mockResolvedValue(withStatus('verificat'))

    await submitButton(wrapper).trigger('click')
    await flushPromises()

    expect(apiPost).toHaveBeenCalledWith('/profile/identity-document')
    expect(wrapper.get('[data-test="dni-status"]').text()).toBe('En revisió')
    expect(wrapper.get('[data-test="dni-countdown"]').text()).toBe('15 s')
    expect(wrapper.find('[data-test="dni-input"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(15000)

    expect(wrapper.get('[data-test="dni-status"]').text()).toBe('Verificat')
    expect(wrapper.text()).toContain('Identitat verificada.')
  })

  it('si l\'enviament falla, mostra un error i deixa tornar-ho a provar', async () => {
    const wrapper = await mountUpload()
    await selectFile(wrapper, 'dni.png', 'image/png')
    apiPost.mockRejectedValue(new ApiError(500, 'Error del servidor'))

    await submitButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("No s'ha pogut enviar el document. Torna-ho a provar.")
    expect(wrapper.get('[data-test="dni-status"]').text()).toBe('Pendent')
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('si ja està verificat no deixa tornar a pujar el document', async () => {
    const wrapper = await mountUpload('verificat')

    expect(wrapper.get('[data-test="dni-status"]').text()).toBe('Verificat')
    expect(wrapper.find('[data-test="dni-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="dni-submit"]').exists()).toBe(false)
  })

  it('allibera la previsualització en sortir', async () => {
    const wrapper = await mountUpload()
    await selectFile(wrapper, 'dni.png', 'image/png')

    wrapper.unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })
})
