import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet, ApiError } from '../services/api'
import PinDialog from '../components/PinDialog.vue'

const PIN_NOT_CONFIGURED = 'Cal configurar el PIN de seguretat al perfil per fer aquesta operació.'

// `configured` és la resposta de GET /profile/pin
async function mountDialog(confirm, { open = true, configured = true } = {}) {
  apiGet.mockResolvedValue({ configurat: configured })
  const blank = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/compte-efectiu', component: blank },
      { path: '/perfil', name: 'perfil', component: blank },
    ],
  })
  router.push('/compte-efectiu')
  await router.isReady()
  const wrapper = mount(PinDialog, {
    props: { open: false, title: 'Confirma la retirada', confirm },
    slots: { default: '50,00 € a ES•• 1332' },
    global: { plugins: [router] },
  })
  // S'obre després de muntar, com quan el pare prem "Continua"
  if (open) {
    await wrapper.setProps({ open: true })
    await flushPromises()
  }
  return { wrapper, router }
}

async function submitPin(wrapper, pin) {
  await wrapper.get('[data-test="pin-input"]').setValue(pin)
  await wrapper.get('[data-test="pin-dialog"]').trigger('submit')
  await flushPromises()
}

describe('PinDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('tancat no mostra res', async () => {
    const { wrapper } = await mountDialog(vi.fn(), { open: false })

    expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
  })

  it("obert mostra el títol i el resum de l'operació", async () => {
    const { wrapper } = await mountDialog(vi.fn())

    // El títol és a la capçalera del diàleg (UiDialog), fora del formulari
    expect(wrapper.get('[data-test="ui-dialog"] h2').text()).toBe('Confirma la retirada')
    expect(wrapper.get('[data-test="pin-dialog"]').text()).toContain('50,00 € a ES•• 1332')
  })

  it("amb un PIN que no és de 4 dígits no executa l'operació", async () => {
    const confirm = vi.fn()
    const { wrapper } = await mountDialog(confirm)

    await submitPin(wrapper, '12a')

    expect(confirm).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('El PIN ha de tenir 4 dígits.')
  })

  it("executa l'operació amb el PIN i avisa quan ha acabat", async () => {
    const confirm = vi.fn().mockResolvedValue({ balance: 50 })
    const { wrapper } = await mountDialog(confirm)

    await submitPin(wrapper, '1234')

    expect(confirm).toHaveBeenCalledWith('1234')
    expect(wrapper.emitted('done')).toEqual([[{ balance: 50 }]])
  })

  it('amb el PIN incorrecte es queda obert, buida el camp i mostra l\'error', async () => {
    const confirm = vi.fn().mockRejectedValue(new ApiError(403, 'El PIN introduït és incorrecte.'))
    const { wrapper } = await mountDialog(confirm)

    await submitPin(wrapper, '1234')

    expect(wrapper.text()).toContain('El PIN introduït és incorrecte.')
    expect(wrapper.get('[data-test="pin-input"]').element.value).toBe('')
    expect(wrapper.emitted('done')).toBeUndefined()
    expect(wrapper.emitted('error')).toBeUndefined()
  })

  it("sense PIN configurat avisa en obrir-lo, abans d'escriure'l, i porta al perfil", async () => {
    const confirm = vi.fn()
    const { wrapper, router } = await mountDialog(confirm, { configured: false })

    expect(apiGet).toHaveBeenCalledWith('/profile/pin')
    expect(wrapper.get('[data-test="pin-missing"]').text()).toBe(PIN_NOT_CONFIGURED)
    expect(wrapper.find('[data-test="pin-input"]').exists()).toBe(false)

    await wrapper.get('[data-test="pin-go-profile"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('perfil')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(confirm).not.toHaveBeenCalled()
  })

  it("si no es pot consultar si hi ha PIN, deixa escriure'l igualment", async () => {
    apiGet.mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const wrapper = mount(PinDialog, {
      props: { open: false, title: 'Confirma la retirada', confirm: vi.fn() },
      global: { plugins: [createRouter({ history: createMemoryHistory(), routes: [] })] },
    })
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(wrapper.find('[data-test="pin-missing"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="pin-input"]').exists()).toBe(true)
  })

  it('si el backend diu que no hi ha PIN, ho avisa igualment', async () => {
    const confirm = vi.fn().mockRejectedValue(new ApiError(403, PIN_NOT_CONFIGURED))
    const { wrapper } = await mountDialog(confirm)

    await submitPin(wrapper, '1234')

    expect(wrapper.get('[data-test="pin-missing"]').text()).toBe(PIN_NOT_CONFIGURED)
    expect(wrapper.find('[data-test="pin-input"]').exists()).toBe(false)
  })

  it('si no es pot validar el PIN mostra l\'error i deixa tornar-ho a provar', async () => {
    const confirm = vi.fn().mockRejectedValue(new ApiError(500, "No s'ha pogut comprovar el PIN"))
    const { wrapper } = await mountDialog(confirm)

    await submitPin(wrapper, '1234')

    expect(wrapper.get('[data-test="pin-alert"]').text())
      .toBe("No s'ha pogut validar el PIN de seguretat. Torna-ho a provar més tard.")
    expect(wrapper.find('[data-test="pin-input"]').exists()).toBe(true)
  })

  it("passa al pare els errors que no són del PIN", async () => {
    const failure = new ApiError(500, "No s'ha pogut processar la retirada. El teu saldo no ha canviat.")
    const confirm = vi.fn().mockRejectedValue(failure)
    const { wrapper } = await mountDialog(confirm)

    await submitPin(wrapper, '1234')

    expect(wrapper.emitted('error')).toEqual([[failure]])
  })

  it('Cancel·la tanca el diàleg sense executar res', async () => {
    const confirm = vi.fn()
    const { wrapper } = await mountDialog(confirm)

    await wrapper.get('[data-test="pin-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('en tornar-lo a obrir comença net', async () => {
    const confirm = vi.fn().mockRejectedValue(new ApiError(403, 'El PIN introduït és incorrecte.'))
    const { wrapper } = await mountDialog(confirm)
    await submitPin(wrapper, '1234')

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(wrapper.text()).not.toContain('El PIN introduït és incorrecte.')
    expect(wrapper.get('[data-test="pin-input"]').element.value).toBe('')
  })
})
