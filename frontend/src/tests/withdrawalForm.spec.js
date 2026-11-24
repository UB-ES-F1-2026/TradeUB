import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))

import { apiGet, apiPost, apiPut, ApiError } from '../services/api'
import { useAccountStore } from '../stores/account'
import { useProfileStore } from '../stores/profile'
import WithdrawalForm from '../components/WithdrawalForm.vue'

const TEST_IBAN = 'ES91 2100 0418 4502 0005 1332'
const MASKED = 'ES•• •••• •••• •••• •••• 1332'
const FAILED = "No s'ha pogut processar la retirada. El teu saldo no ha canviat."

async function mountForm({ iban = MASKED, balance = 100, loadError = null } = {}) {
  if (loadError) apiGet.mockRejectedValue(loadError)
  else apiGet.mockResolvedValue({ perfil: { iban_emmascarat: iban } })
  useAccountStore().balance = balance
  // El diàleg del PIN no consulta GET /profile/pin si ja se sap que n'hi ha (els casos sense PIN, a pinDialog.spec.js)
  useProfileStore().pinConfigured = true
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
  const wrapper = mount(WithdrawalForm, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

async function continueWith(wrapper, amount) {
  await wrapper.get('[data-test="withdrawal-amount"]').setValue(amount)
  await wrapper.get('[data-test="withdrawal-amount-form"]').trigger('submit')
  await flushPromises()
}

async function confirmWith(wrapper, pin) {
  await wrapper.get('[data-test="pin-input"]').setValue(pin)
  await wrapper.get('[data-test="pin-dialog"]').trigger('submit')
  await flushPromises()
}

async function linkIban(wrapper, iban) {
  await wrapper.get('[data-test="withdrawal-iban"]').setValue(iban)
  await wrapper.get('[data-test="withdrawal-iban-form"]').trigger('submit')
  await flushPromises()
}

describe('WithdrawalForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('IBAN', () => {
    it("sense IBAN vinculat el demana primer i no deixa escriure l'import", async () => {
      const { wrapper } = await mountForm({ iban: null })

      expect(apiGet).toHaveBeenCalledWith('/users/me')
      expect(wrapper.text()).toContain('És una simulació: fes servir un IBAN de prova.')
      expect(wrapper.text()).toContain("Vincula l'IBAN")
      expect(wrapper.find('[data-test="withdrawal-amount"]').exists()).toBe(false)
    })

    it('un IBAN no vàlid no arriba al backend', async () => {
      const { wrapper } = await mountForm({ iban: null })

      await linkIban(wrapper, 'ES91 2100 0418 4502 0005 1333')

      expect(apiPut).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('El codi IBAN no és vàlid.')
    })

    it("vincula l'IBAN net i el mostra emmascarat", async () => {
      apiPut.mockResolvedValue({ iban_emmascarat: MASKED })
      const { wrapper } = await mountForm({ iban: null })

      await linkIban(wrapper, TEST_IBAN.toLowerCase())

      expect(apiPut).toHaveBeenCalledWith('/profile/iban', { iban: 'ES9121000418450200051332' })
      expect(wrapper.get('[data-test="withdrawal-iban-masked"]').text()).toBe(MASKED)
      expect(wrapper.find('[data-test="withdrawal-amount"]').exists()).toBe(true)
    })

    it("mostra sota el camp l'error del backend", async () => {
      apiPut.mockRejectedValue(new ApiError(422, 'El codi IBAN no és vàlid.'))
      const { wrapper } = await mountForm({ iban: null })

      await linkIban(wrapper, TEST_IBAN)

      expect(wrapper.text()).toContain('El codi IBAN no és vàlid.')
      expect(wrapper.find('[data-test="withdrawal-iban-masked"]').exists()).toBe(false)
    })

    it('"Canvia" substitueix l\'IBAN directament', async () => {
      apiPut.mockResolvedValue({ iban_emmascarat: 'ES•• •••• •••• •••• •••• 9999' })
      const { wrapper } = await mountForm()

      await wrapper.get('[data-test="withdrawal-change-iban"]').trigger('click')
      await linkIban(wrapper, TEST_IBAN)

      expect(apiPut).toHaveBeenCalledTimes(1)
      expect(wrapper.get('[data-test="withdrawal-iban-masked"]').text()).toBe('ES•• •••• •••• •••• •••• 9999')
    })

    it("si no es pot llegir l'IBAN, avisa", async () => {
      const { wrapper } = await mountForm({ loadError: new ApiError(500, 'Error del servidor') })

      expect(wrapper.text()).toContain("No s'ha pogut carregar l'IBAN vinculat.")
    })

    it("torna a provar de llegir l'IBAN", async () => {
      const { wrapper } = await mountForm({ loadError: new ApiError(500, 'Error del servidor') })
      apiGet.mockResolvedValue({ perfil: { iban_emmascarat: MASKED } })

      await wrapper.get('[data-test="withdrawal-iban-retry"]').trigger('click')
      await flushPromises()

      expect(apiGet).toHaveBeenCalledTimes(2)
      expect(wrapper.get('[data-test="withdrawal-iban-masked"]').text()).toBe(MASKED)
    })

    it('"Canvia" no es pot fer servir durant el pas del PIN', async () => {
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')

      expect(wrapper.get('[data-test="withdrawal-change-iban"]').attributes('disabled')).toBeDefined()
    })
  })

  describe('import', () => {
    it("menys d'1 € no passa al PIN", async () => {
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '0,50')

      expect(wrapper.text()).toContain("L'import mínim de retirada és d'1 €.")
      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
    })

    it('amb més import que saldo diu quant falta', async () => {
      const { wrapper } = await mountForm({ balance: 20 })

      await continueWith(wrapper, '25,50')

      expect(wrapper.text()).toContain('Saldo insuficient. Et falten 5,50')
      expect(wrapper.text()).toContain("per completar l'operació")
      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
    })
  })

  describe('PIN', () => {
    it("demana el PIN amb el resum de l'operació", async () => {
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '50,25')

      const step = wrapper.get('[data-test="pin-dialog"]')
      expect(step.text()).toContain('Confirma la retirada')
      expect(step.text()).toContain('50,25')
      expect(step.text()).toContain(MASKED)
      expect(apiPost).not.toHaveBeenCalled()
    })

    it('envia el PIN a la capçalera i actualitza el saldo', async () => {
      apiPost.mockResolvedValue({ balance: '49.75' })
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '50,25')
      await confirmWith(wrapper, '1234')

      expect(apiPost).toHaveBeenCalledWith('/account/withdrawals', { amount: '50.25' }, { 'X-PIN': '1234' })
      expect(useAccountStore().balance).toBe(49.75)
      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="withdrawal-amount"]').element.value).toBe('')
    })

    it("confirma la retirada amb l'import i el missatge desapareix en tornar a escriure", async () => {
      apiPost.mockResolvedValue({ balance: '49.75' })
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '50,25')
      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="withdrawal-success"]').text().replace(/\s/g, ' '))
        .toBe("S'han retirat 50,25 € del compte.")

      await wrapper.get('[data-test="withdrawal-amount"]').setValue('10')

      expect(wrapper.find('[data-test="withdrawal-success"]').exists()).toBe(false)
    })

    it('si la retirada falla no mostra cap confirmació', async () => {
      apiPost.mockRejectedValue(new ApiError(500, 'Error del servidor'))
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '1234')

      expect(wrapper.find('[data-test="withdrawal-success"]').exists()).toBe(false)
    })

    it('un PIN de menys de 4 xifres no arriba al backend', async () => {
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '12')

      expect(apiPost).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('El PIN ha de tenir 4 dígits.')
    })

    it('amb el PIN incorrecte el pas es queda obert i el camp es buida', async () => {
      apiPost.mockRejectedValue(new ApiError(403, 'El PIN introduït és incorrecte.'))
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '0000')

      expect(wrapper.text()).toContain('El PIN introduït és incorrecte.')
      expect(wrapper.get('[data-test="pin-input"]').element.value).toBe('')
      expect(useAccountStore().balance).toBe(100)
    })

    it('sense PIN configurat porta al perfil', async () => {
      apiPost.mockRejectedValue(
        new ApiError(403, 'Cal configurar el PIN de seguretat al perfil per fer aquesta operació.'),
      )
      const { wrapper, router } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="pin-missing"]').text())
        .toBe('Cal configurar el PIN de seguretat al perfil per fer aquesta operació.')
      expect(wrapper.find('[data-test="pin-input"]').exists()).toBe(false)

      await wrapper.get('[data-test="pin-go-profile"]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/perfil')
    })

    it('si no es pot validar el PIN ho avisa dins del pas', async () => {
      apiPost.mockRejectedValue(new ApiError(500, "No s'ha pogut comprovar el PIN"))
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="pin-dialog"]').text())
        .toContain("No s'ha pogut validar el PIN de seguretat. Torna-ho a provar més tard.")
    })

    it("cancel·lar no fa res i conserva l'import", async () => {
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await wrapper.get('[data-test="pin-cancel"]').trigger('click')

      expect(apiPost).not.toHaveBeenCalled()
      expect(wrapper.get('[data-test="withdrawal-amount"]').element.value).toBe('10')
    })
  })

  describe("errors de l'operació", () => {
    it('el saldo insuficient del backend tanca el PIN i surt sota el camp', async () => {
      const message = "Saldo insuficient. Et falten 5,00 € per completar l'operació"
      apiPost.mockRejectedValue(new ApiError(400, message))
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '1234')

      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
      expect(wrapper.text()).toContain(message)
      expect(wrapper.find('[data-test="withdrawal-error"]').exists()).toBe(false)
    })

    it("si el backend diu que no hi ha IBAN, ho avisa i torna a demanar l'IBAN", async () => {
      apiPost.mockRejectedValue(new ApiError(422, 'Cal vincular un IBAN per retirar diners.'))
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="withdrawal-error"]').text()).toBe('Cal vincular un IBAN per retirar diners.')
      expect(wrapper.find('[data-test="withdrawal-iban-form"]').exists()).toBe(true)
      // No depèn de tornar a llegir el perfil: el backend ja ha dit que no n'hi ha
      expect(apiGet).toHaveBeenCalledTimes(1)
    })

    it('si falla la base de dades avisa a dalt que el saldo no ha canviat', async () => {
      apiPost.mockRejectedValue(new ApiError(500, 'Error del servidor'))
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="withdrawal-error"]').text()).toBe(FAILED)
      expect(useAccountStore().balance).toBe(100)
    })

    it('si no arriba al backend també diu que el saldo no ha canviat', async () => {
      apiPost.mockRejectedValue(new TypeError('Failed to fetch'))
      const { wrapper } = await mountForm()

      await continueWith(wrapper, '10')
      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="withdrawal-error"]').text()).toBe(FAILED)
    })
  })
})
