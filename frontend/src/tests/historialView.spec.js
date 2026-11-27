import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet } from '../services/api'
import HistorialView from '../views/HistorialView.vue'

const VERIFIED = { verificacio: { estat: 'verificat', termes_acceptats: true } }
const PENDING = { verificacio: { estat: 'pendent', termes_acceptats: false } }

const withdrawal = {
  created_at: '2026-11-13T12:00:00+00:00',
  concept: 'Retirada a ES•• 1332',
  amount: '-100.00',
  type: 'retirada',
  balance_after: '1150.00',
}
const deposit = {
  created_at: '2026-11-12T12:00:00+00:00',
  concept: 'Ingrés de diners',
  amount: '250.00',
  type: 'ingres',
  balance_after: '1250.00',
}

// /users/me dona l'estat de verificació; /account/movements, la pàgina demanada
function mockApi(user, ...pages) {
  const queue = [...pages]
  apiGet.mockImplementation(async (path) => {
    if (path === '/users/me') return user
    return queue.length > 1 ? queue.shift() : queue[0]
  })
}

const movementCalls = () => apiGet.mock.calls.map(([path]) => path).filter((p) => p.startsWith('/account/movements'))

async function mountHistorial() {
  const blank = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/historial', component: HistorialView },
      { path: '/onboarding', name: 'onboarding', component: blank },
    ],
  })
  router.push('/historial')
  await router.isReady()
  const wrapper = mount(HistorialView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('HistorialView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('mostra cada moviment amb el concepte, el tipus, l\'import amb signe i el saldo resultant', async () => {
    mockApi(VERIFIED, { movements: [withdrawal, deposit], has_more: false })
    const wrapper = await mountHistorial()

    const rows = wrapper.findAll('[data-test="movement-row"]')
    expect(rows).toHaveLength(2)

    expect(rows[0].text()).toContain('13/11/2026')
    expect(rows[0].text()).toContain('Retirada a ES•• 1332')
    expect(rows[0].get('[data-test="movement-type"]').text()).toBe('Retirada')
    const out = rows[0].get('[data-test="movement-amount"]')
    expect(out.text()).toMatch(/^−100,00\s€$/)
    expect(out.classes()).toContain('movements__amount--out')
    expect(rows[0].get('[data-test="movement-balance"]').text()).toMatch(/1\.150,00\s€/)

    const incoming = rows[1].get('[data-test="movement-amount"]')
    expect(incoming.text()).toMatch(/^\+250,00\s€$/)
    expect(incoming.classes()).toContain('movements__amount--in')
    expect(rows[1].get('[data-test="movement-type"]').text()).toBe('Ingrés')
  })

  it('sense resultats mostra el missatge de filtres buits', async () => {
    mockApi(VERIFIED, { movements: [], has_more: false })
    const wrapper = await mountHistorial()

    expect(wrapper.get('[data-test="movements-empty"]').text())
      .toBe("No s'han trobat moviments per als filtres seleccionats.")
    expect(wrapper.find('[data-test="page-next"]').exists()).toBe(false)
  })

  it('pagina amb Anterior i Següent segons has_more', async () => {
    mockApi(
      VERIFIED,
      { movements: [withdrawal], has_more: true },
      { movements: [deposit], has_more: false },
      { movements: [withdrawal], has_more: true },
    )
    const wrapper = await mountHistorial()

    expect(wrapper.get('[data-test="page-number"]').text()).toBe('Pàgina 1')
    expect(wrapper.get('[data-test="page-prev"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="page-next"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-test="page-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="page-number"]').text()).toBe('Pàgina 2')
    expect(movementCalls().at(-1)).toContain('offset=20')
    expect(wrapper.get('[data-test="page-next"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-test="page-prev"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="page-number"]').text()).toBe('Pàgina 1')
    expect(movementCalls().at(-1)).toContain('offset=0')
  })

  it('en canviar el tipus torna a carregar des de la primera pàgina amb el filtre', async () => {
    mockApi(VERIFIED, { movements: [withdrawal], has_more: true })
    const wrapper = await mountHistorial()
    await wrapper.get('[data-test="page-next"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-test="filter-type"]').setValue('retirada')
    await flushPromises()

    const query = new URLSearchParams(movementCalls().at(-1).split('?')[1])
    expect(query.get('type')).toBe('retirada')
    expect(query.get('offset')).toBe('0')
    expect(wrapper.get('[data-test="page-number"]').text()).toBe('Pàgina 1')
  })

  it("amb la data inici posterior a la data fi mostra l'error i no crida el backend", async () => {
    mockApi(VERIFIED, { movements: [withdrawal], has_more: false })
    const wrapper = await mountHistorial()
    const calls = movementCalls().length

    await wrapper.get('[data-test="filter-from"]').setValue('2026-11-10')
    await wrapper.get('[data-test="filter-to"]').setValue('2026-11-01')
    await flushPromises()

    expect(wrapper.text()).toContain("La data d'inici no pot ser posterior a la data de fi.")
    // Només la data inici, encara vàlida, ha fet una petició
    expect(movementCalls()).toHaveLength(calls + 1)
    expect(wrapper.find('[data-test="movements-empty"]').exists()).toBe(false)
  })

  it("sense verificar mostra l'avís per verificar-se i no demana l'historial", async () => {
    mockApi(PENDING, { movements: [], has_more: false })
    const wrapper = await mountHistorial()

    expect(wrapper.get('[data-test="verification-required"]').text()).toContain("per consultar l'historial")
    expect(wrapper.find('[data-test="movement-filters"]').exists()).toBe(false)
    expect(movementCalls()).toHaveLength(0)
  })
})

describe("HistorialView: detall d'una compra o venda (US6.5)", () => {
  const buy = {
    created_at: '2026-11-26T09:42:00+00:00',
    concept: 'Compra de 3 AAPL',
    amount: '-638.20',
    type: 'compra',
    balance_after: '9361.80',
    order_id: 'ordre-1',
  }
  // Una compra anterior a la taula d'ordres: no té order_id
  const oldBuy = { ...buy, concept: "Compra d'actius", order_id: null }
  const order = {
    id: 'ordre-1',
    side: 'compra',
    status: 'executada',
    asset: { id: 7, name: 'Apple Inc.', ticker: 'AAPL' },
    units: '3.00000000',
    price: '212.400000',
    amount: '637.20',
    commission: '1.00',
    total: '638.20',
    created_at: buy.created_at,
    executed_at: buy.created_at,
    balance_after: '9361.80',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    apiGet.mockImplementation(async (path) => {
      if (path === '/users/me') return VERIFIED
      if (path.startsWith('/orders/')) return order
      return { movements: [buy, deposit, oldBuy, withdrawal], has_more: true }
    })
  })

  const rows = (wrapper) => wrapper.findAll('[data-test="movement-row"]')
  const dialogOpen = (wrapper) => wrapper.find('[data-test="ui-dialog"]').exists()

  it('només les files amb ordre es poden obrir i porten "›"', async () => {
    const wrapper = await mountHistorial()

    const openable = rows(wrapper).map((r) => r.classes().includes('movements__row--openable'))
    expect(openable).toEqual([true, false, false, false])
    expect(rows(wrapper)[0].attributes('tabindex')).toBe('0')
    expect(rows(wrapper)[0].text()).toContain('›')
    expect(rows(wrapper)[1].attributes('tabindex')).toBeUndefined()
    expect(rows(wrapper)[1].text()).not.toContain('›')
  })

  it("en fer clic a una compra n'obre el detall", async () => {
    const wrapper = await mountHistorial()

    await rows(wrapper)[0].trigger('click')
    await flushPromises()

    expect(apiGet).toHaveBeenCalledWith('/orders/ordre-1')
    expect(wrapper.get('[data-test="ui-dialog"] h2').text()).toBe("Detall de l'operació")
    expect(wrapper.get('[data-test="order-asset"] dd').text()).toBe('Apple Inc. (AAPL)')
  })

  it("amb el teclat (Retorn i espai) també s'obre", async () => {
    const wrapper = await mountHistorial()

    await rows(wrapper)[0].trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(dialogOpen(wrapper)).toBe(true)

    await wrapper.get('[data-test="order-close"]').trigger('click')
    await rows(wrapper)[0].trigger('keydown', { key: ' ' })
    await flushPromises()
    expect(dialogOpen(wrapper)).toBe(true)
  })

  it('els ingressos, les retirades i les compres sense ordre no obren res', async () => {
    const wrapper = await mountHistorial()

    for (const index of [1, 2, 3]) {
      await rows(wrapper)[index].trigger('click')
      await rows(wrapper)[index].trigger('keydown', { key: 'Enter' })
    }
    await flushPromises()

    expect(dialogOpen(wrapper)).toBe(false)
    expect(apiGet.mock.calls.some(([path]) => path.startsWith('/orders/'))).toBe(false)
  })

  it('obrir i tancar el detall conserva els filtres i la pàgina sense tornar a carregar la llista', async () => {
    const wrapper = await mountHistorial()
    await wrapper.get('[data-test="page-next"]').trigger('click')
    await flushPromises()
    const callsBefore = movementCalls().length

    await rows(wrapper)[0].trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="order-close"]').trigger('click')
    await flushPromises()

    expect(dialogOpen(wrapper)).toBe(false)
    expect(wrapper.get('[data-test="page-number"]').text()).toBe('Pàgina 2')
    expect(movementCalls()).toHaveLength(callsBefore)
  })
})
