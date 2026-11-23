import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost, ApiError } from '../services/api'
import { useAccountStore } from '../stores/account'
import { useProfileStore } from '../stores/profile'
import { formatCurrency } from '../utils/currency'
import BuyCard from '../components/BuyCard.vue'

const ASSET = { id: 7, name: 'Apple Inc.', ticker: 'AAPL', type: 'accio', close_price_eur: '10.10' }
const FAILED = "No s'ha pogut processar la compra. El teu saldo no ha canviat."
const eur = (amount) => formatCurrency(amount, 'EUR')

async function mountCard({ balance = 100 } = {}) {
  useAccountStore().balance = balance
  // El diàleg del PIN no consulta GET /profile/pin si ja se sap que n'hi ha (els casos sense PIN, a pinDialog.spec.js)
  useProfileStore().pinConfigured = true
  const blank = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/actius', component: blank },
      { path: '/perfil', name: 'perfil', component: blank },
    ],
  })
  router.push('/actius')
  await router.isReady()
  const wrapper = mount(BuyCard, { props: { asset: ASSET }, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

async function typeUnits(wrapper, units) {
  await wrapper.get('[data-test="buy-units"]').setValue(units)
}

async function continueWith(wrapper, units) {
  await typeUnits(wrapper, units)
  await wrapper.get('[data-test="buy-units-form"]').trigger('submit')
  await flushPromises()
}

async function confirmWith(wrapper, pin) {
  await wrapper.get('[data-test="pin-input"]').setValue(pin)
  await wrapper.get('[data-test="pin-dialog"]').trigger('submit')
  await flushPromises()
}

describe('BuyCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('revisió del cost', () => {
    it("mostra l'actiu i el preu per unitat", async () => {
      const { wrapper } = await mountCard()

      expect(wrapper.text()).toContain('Apple Inc.')
      expect(wrapper.text()).toContain(`AAPL · ${eur(10.1)} per unitat`)
      expect(wrapper.find('[data-test="buy-summary"]').exists()).toBe(false)
    })

    it('amb unitats vàlides mostra el cost, la comissió, el total i el saldo restant', async () => {
      const { wrapper } = await mountCard({ balance: 100 })

      await typeUnits(wrapper, '3')

      expect(wrapper.get('[data-test="buy-cost"]').text()).toBe(eur(30.3))
      expect(wrapper.get('[data-test="buy-commission"]').text()).toBe(eur(0.31))
      expect(wrapper.get('[data-test="buy-total"]').text()).toBe(eur(30.61))
      expect(wrapper.get('[data-test="buy-remaining"]').text()).toBe(eur(69.39))
      expect(wrapper.text()).toContain('Cost (3 unitats)')
    })

    it('sense saldo suficient avisa, desactiva "Continua" i no mostra el saldo restant', async () => {
      const { wrapper } = await mountCard({ balance: 20 })

      await typeUnits(wrapper, '3')

      expect(wrapper.get('[data-test="buy-insufficient"]').text()).toContain(eur(10.61))
      expect(wrapper.get('[data-test="buy-continue"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-test="buy-remaining"]').exists()).toBe(false)
    })

    it('amb unitats no vàlides mostra l\'error i no passa al PIN', async () => {
      const { wrapper } = await mountCard()

      await continueWith(wrapper, '1,5')

      expect(wrapper.text()).toContain('Les unitats han de ser un nombre enter positiu.')
      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
    })

    it('sense el saldo carregat el demana en obrir-se', async () => {
      apiGet.mockResolvedValue({ balance: '50.00', currency: 'EUR' })
      await mountCard({ balance: null })

      expect(apiGet).toHaveBeenCalledWith('/account/balance')
    })

    it('"Cancel·la" tanca la targeta', async () => {
      const { wrapper } = await mountCard()

      await wrapper.get('[data-test="buy-cancel"]').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('PIN', () => {
    it('"Continua" obre el diàleg del PIN amb el resum', async () => {
      const { wrapper } = await mountCard()

      await continueWith(wrapper, '3')

      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(true)
      expect(wrapper.text()).toContain(`3 unitats de AAPL per ${eur(30.61)}`)
      expect(wrapper.get('[data-test="pin-input"]').attributes('maxlength')).toBe('4')
    })

    it('un PIN amb format incorrecte no arriba al backend', async () => {
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '12')

      expect(apiPost).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('El PIN ha de tenir 4 dígits.')
    })

    it('compra amb el PIN a la capçalera, actualitza el saldo i tanca la targeta', async () => {
      apiPost.mockResolvedValue({ balance: '69.39', cost: '30.30', commission: '0.31', total: '30.61' })
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(apiPost).toHaveBeenCalledWith('/orders/buy', { asset_id: 7, units: 3 }, { 'X-PIN': '1234' })
      expect(useAccountStore().balance).toBe(69.39)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('amb el PIN incorrecte el diàleg es queda obert i el camp es buida', async () => {
      apiPost.mockRejectedValue(new ApiError(403, 'El PIN introduït és incorrecte.'))
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '9999')

      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('El PIN introduït és incorrecte.')
      expect(wrapper.get('[data-test="pin-input"]').element.value).toBe('')
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('sense PIN configurat porta al perfil', async () => {
      apiPost.mockRejectedValue(
        new ApiError(403, 'Cal configurar el PIN de seguretat al perfil per fer aquesta operació.'),
      )
      const { wrapper, router } = await mountCard()
      await continueWith(wrapper, '3')
      await confirmWith(wrapper, '1234')

      expect(wrapper.find('[data-test="pin-missing"]').exists()).toBe(true)
      await wrapper.get('[data-test="pin-go-profile"]').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('perfil')
    })

    it('"Cancel·la" torna a les unitats sense comprar i les conserva', async () => {
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await wrapper.get('[data-test="pin-cancel"]').trigger('click')

      expect(apiPost).not.toHaveBeenCalled()
      expect(wrapper.get('[data-test="buy-units"]').element.value).toBe('3')
    })
  })

  describe('errors del backend', () => {
    it('amb saldo insuficient al backend tanca el diàleg, avisa i recarrega el saldo', async () => {
      apiPost.mockRejectedValue(new ApiError(422, 'No tens saldo suficient per fer aquesta compra.'))
      apiGet.mockResolvedValue({ balance: '5.00', currency: 'EUR' })
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="buy-error"]').text()).toBe('No tens saldo suficient per fer aquesta compra.')
      expect(apiGet).toHaveBeenCalledWith('/account/balance')
    })

    it("si l'actiu no existeix mostra el missatge del backend", async () => {
      apiPost.mockRejectedValue(new ApiError(404, 'Actiu no trobat'))
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="buy-error"]').text()).toBe('Actiu no trobat')
    })

    it('qualsevol altre error mostra el missatge genèric', async () => {
      apiPost.mockRejectedValue(new ApiError(500, 'Error intern'))
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="buy-error"]').text()).toBe(FAILED)
      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })
})
