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
import SellCard from '../components/SellCard.vue'

const ASSET = { id: 7, name: 'Apple Inc.', ticker: 'AAPL', type: 'accio', close_price_eur: '10.10' }
const FAILED = "No s'ha pogut processar la venda. El teu saldo no ha canviat."
const NOT_ENOUGH = "No tens prou unitats d'aquest actiu per vendre."
const eur = (amount) => formatCurrency(amount, 'EUR')

async function mountCard({ held = 5, balance = 100 } = {}) {
  const account = useAccountStore()
  account.balance = balance
  account.positions = { [ASSET.id]: held }
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
  const wrapper = mount(SellCard, { props: { asset: ASSET }, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper }
}

async function typeUnits(wrapper, units) {
  await wrapper.get('[data-test="sell-units"]').setValue(units)
}

async function continueWith(wrapper, units) {
  await typeUnits(wrapper, units)
  await wrapper.get('[data-test="sell-units-form"]').trigger('submit')
  await flushPromises()
}

async function confirmWith(wrapper, pin) {
  await wrapper.get('[data-test="pin-input"]').setValue(pin)
  await wrapper.get('[data-test="pin-dialog"]').trigger('submit')
  await flushPromises()
}

describe('SellCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('import net', () => {
    it("mostra l'actiu, el preu per unitat i les unitats que es tenen", async () => {
      const { wrapper } = await mountCard({ held: 5 })

      expect(wrapper.text()).toContain('Apple Inc.')
      expect(wrapper.text()).toContain(`AAPL · ${eur(10.1)} per unitat`)
      expect(wrapper.text()).toContain('Tens 5 unitats.')
      expect(wrapper.find('[data-test="sell-summary"]').exists()).toBe(false)
    })

    it("amb unitats vàlides mostra l'import, la comissió descomptada i l'import net", async () => {
      const { wrapper } = await mountCard()

      await typeUnits(wrapper, '3')

      expect(wrapper.get('[data-test="sell-amount"]').text()).toBe(eur(30.3))
      expect(wrapper.get('[data-test="sell-commission"]').text()).toBe(`−${eur(0.31)}`)
      expect(wrapper.get('[data-test="sell-net"]').text()).toBe(eur(29.99))
      expect(wrapper.text()).toContain('Import (3 unitats)')
    })

    it('amb més unitats de les que es tenen avisa, desactiva "Continua" i no mostra la revisió', async () => {
      const { wrapper } = await mountCard({ held: 2 })

      await typeUnits(wrapper, '3')

      expect(wrapper.text()).toContain(NOT_ENOUGH)
      expect(wrapper.get('[data-test="sell-continue"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-test="sell-summary"]').exists()).toBe(false)
    })

    it('es poden vendre totes les unitats de la posició', async () => {
      const { wrapper } = await mountCard({ held: 3 })

      await continueWith(wrapper, '3')

      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(true)
    })

    it("amb unitats no vàlides mostra l'error i no passa al PIN", async () => {
      const { wrapper } = await mountCard()

      await continueWith(wrapper, '1,5')

      expect(wrapper.text()).toContain('Les unitats han de ser un nombre enter positiu.')
      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
    })

    it('"Cancel·la" tanca la targeta', async () => {
      const { wrapper } = await mountCard()

      await wrapper.get('[data-test="sell-cancel"]').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('PIN', () => {
    it('"Continua" obre el diàleg del PIN amb el resum', async () => {
      const { wrapper } = await mountCard()

      await continueWith(wrapper, '3')

      expect(wrapper.get('[data-test="ui-dialog"] h2').text()).toBe('Confirma la venda')
      expect(wrapper.get('[data-test="pin-dialog"]').text()).toContain(`3 unitats de AAPL. Rebràs ${eur(29.99)}`)
    })

    it('ven amb el PIN a la capçalera, actualitza el saldo i la posició i tanca la targeta', async () => {
      apiPost.mockResolvedValue({ balance: '129.99', units: '2', amount: '30.30', commission: '0.31', net: '29.99' })
      const { wrapper } = await mountCard({ held: 5, balance: 100 })
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(apiPost).toHaveBeenCalledWith('/orders/sell', { asset_id: 7, units: 3 }, { 'X-PIN': '1234' })
      expect(useAccountStore().balance).toBe(129.99)
      expect(useAccountStore().unitsHeld(7)).toBe(2)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('amb el PIN incorrecte el diàleg es queda obert i no ven', async () => {
      apiPost.mockRejectedValue(new ApiError(403, 'El PIN introduït és incorrecte.'))
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '9999')

      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('El PIN introduït és incorrecte.')
      expect(useAccountStore().unitsHeld(7)).toBe(5)
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('"Cancel·la" del diàleg no ven i conserva les unitats', async () => {
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await wrapper.get('[data-test="pin-cancel"]').trigger('click')

      expect(apiPost).not.toHaveBeenCalled()
      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="sell-units"]').element.value).toBe('3')
    })
  })

  describe('errors del backend', () => {
    it('si ja no hi ha prou unitats tanca el diàleg, avisa al camp i torna a llegir les posicions', async () => {
      apiPost.mockRejectedValue(new ApiError(422, NOT_ENOUGH))
      apiGet.mockResolvedValue([{ asset_id: 7, units: 1 }])
      const { wrapper } = await mountCard({ held: 5 })
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
      expect(wrapper.text()).toContain(NOT_ENOUGH)
      expect(apiGet).toHaveBeenCalledWith('/account/positions')
      expect(useAccountStore().unitsHeld(7)).toBe(1)
    })

    it("si l'actiu no existeix mostra el missatge del backend", async () => {
      apiPost.mockRejectedValue(new ApiError(404, 'Actiu no trobat'))
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="sell-error"]').text()).toBe('Actiu no trobat')
    })

    it('qualsevol altre error mostra el missatge genèric', async () => {
      apiPost.mockRejectedValue(new ApiError(500, 'Error intern'))
      const { wrapper } = await mountCard()
      await continueWith(wrapper, '3')

      await confirmWith(wrapper, '1234')

      expect(wrapper.get('[data-test="sell-error"]').text()).toBe(FAILED)
      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })
})
