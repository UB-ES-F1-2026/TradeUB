import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Tests d'acceptació del Sprint 2 (QA 5, #133): App, router i stores reals. Només es simulen Supabase (sessió) i
// el backend, amb un backend fals que guarda el saldo i els moviments perquè un ingrés es vegi a l'historial.
// Els textos són literals dels criteris de Trello, no les constants del codi. Taula criteri → test a
// docs/qa/pla-proves.md
vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(),
    },
  },
}))

import App from '../../App.vue'
import router from '../../router'
import { useAuthStore } from '../../stores/auth'

const user = { id: 'u1', email: 'prova@exemple.com', user_metadata: {} }
const session = { access_token: 'token', user }

// Catàleg simulat desordenat: el backend el retorna ordenat per nom
const CATALOG = [
  { name: 'Microsoft Corp.', ticker: 'MSFT', isin: 'US5949181045', type: 'accio' },
  { name: 'Apple Inc.', ticker: 'AAPL', isin: 'US0378331005', type: 'accio' },
  { name: 'iShares Core MSCI World', ticker: 'IWDA', isin: 'IE00B4L5Y983', type: 'etf' },
]

const json = (status, body) => ({ ok: status < 400, status, json: async () => body })
const NOT_VERIFIED = json(403, { detail: 'Cal verificar la identitat i acceptar els termes per operar' })

const API_URL = String(import.meta.env.VITE_API_URL)

// Backend fals amb estat, amb el mateix contracte que l'API
let backend
function createBackend({ verified = true, balance = 100 } = {}) {
  return {
    verified, balance, movements: [], failDeposits: false, catalog: structuredClone(CATALOG),
    iban: MASKED_IBAN, pin: '1234', pinCheckFails: false,
  }
}

const MASKED_IBAN = 'ES•• •••• •••• •••• •••• 1332'

function addMovement(type, concept, amount) {
  backend.balance += amount
  backend.movements.unshift({
    created_at: '2026-11-22T10:42:00Z',
    concept,
    type,
    amount: amount.toFixed(2),
    balance_after: backend.balance.toFixed(2),
  })
}

const fetchMock = vi.fn(async (url, init = {}) => {
  // api.js crida `${VITE_API_URL}${path}`; a la CI la variable no existeix i l'URL comença per "undefined"
  const { pathname, searchParams } = new URL(String(url).slice(API_URL.length), 'http://api')
  const route = `${init.method ?? 'GET'} ${pathname}`

  if (route === 'GET /users/me') {
    const verificacio = backend.verified
      ? { estat: 'verificat', termes_acceptats: true }
      : { estat: 'pendent', termes_acceptats: false }
    return json(200, { verificacio, onboarding: { steps: [] }, perfil: { iban_emmascarat: backend.iban } })
  }
  if (route === 'GET /assets') {
    const q = (searchParams.get('q') ?? '').toLowerCase()
    const found = backend.catalog.filter((a) => `${a.name} ${a.ticker}`.toLowerCase().includes(q) || a.isin.toLowerCase() === q)
    return json(200, found.sort((a, b) => a.name.localeCompare(b.name)))
  }
  if (!backend.verified) return NOT_VERIFIED
  if (route === 'GET /account/balance') return json(200, { balance: backend.balance.toFixed(2), currency: 'EUR' })
  if (route === 'POST /account/deposits') {
    if (backend.failDeposits) return json(500, { detail: 'boom' })
    addMovement('ingres', 'Ingrés de diners', Number(JSON.parse(init.body).amount))
    return json(201, { balance: backend.balance })
  }
  if (route === 'PUT /profile/iban') {
    backend.iban = MASKED_IBAN
    return json(200, { iban_emmascarat: backend.iban })
  }
  if (route === 'GET /profile/pin') return json(200, { configurat: Boolean(backend.pin) })
  if (route === 'POST /account/withdrawals') {
    // Mateix ordre que l'endpoint: primer el PIN (require_pin) i després el saldo
    if (backend.pinCheckFails) return json(500, { detail: "No s'ha pogut comprovar el PIN" })
    if (!backend.pin) {
      return json(403, { detail: 'Cal configurar el PIN de seguretat al perfil per fer aquesta operació.' })
    }
    if (init.headers['X-PIN'] !== backend.pin) return json(403, { detail: 'El PIN introduït és incorrecte.' })
    addMovement('retirada', `Retirada a ES•• ${backend.iban.slice(-4)}`, -Number(JSON.parse(init.body).amount))
    return json(201, { balance: backend.balance })
  }
  if (route === 'GET /account/movements') return json(200, { movements: backend.movements, has_more: false })
  throw new Error(`Crida no esperada: ${route}`)
})

const calls = (method, path) =>
  fetchMock.mock.calls.filter(([url, init = {}]) => (init.method ?? 'GET') === method && String(url).includes(path))

let wrapper
async function mountAt(path) {
  const auth = useAuthStore()
  auth.session = session
  auth.user = user
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const navLink = (text) => wrapper.findAll('nav a').find((a) => a.text() === text)
// Intl separa l'import i el símbol € amb un espai dur
const text = (w) => w.text().replace(/\u00a0/g, ' ')
const total = () => text(wrapper.find('[data-test="total"]'))

async function deposit(amount) {
  // Les vistes es carreguen amb import(): s'espera el formulari en comptes de comptar ticks
  const input = await vi.waitFor(() => wrapper.get('[data-test="deposit-amount"]'))
  await input.setValue(amount)
  await formWith('[data-test="deposit-amount"]').trigger('submit')
  await flushPromises()
}

// Compte d'efectiu té diversos formularis (ingrés, IBAN, retirada): es busca el que conté el camp
const formWith = (selector) => wrapper.findAll('form').find((f) => f.find(selector).exists())
const buttonText = (label) => wrapper.findAll('button').find((b) => b.text() === label)

// Import → "Continua" → diàleg del PIN → "Confirma", com ho fa l'usuari
async function withdraw(amount, pin) {
  const input = await vi.waitFor(() => wrapper.get('[data-test="withdrawal-amount"]'))
  await input.setValue(amount)
  await formWith('[data-test="withdrawal-amount"]').trigger('submit')
  await flushPromises()
  if (pin === undefined) return
  await wrapper.get('[data-test="pin-input"]').setValue(pin)
  await wrapper.get('[data-test="pin-dialog"]').trigger('submit')
  await flushPromises()
}

describe('Acceptació Sprint 2: ingrés i historial (US3.2 + US3.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    backend = createBackend()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it("un ingrés actualitza el saldo a l'instant i apareix a l'historial", async () => {
    await mountAt('/compte-efectiu')
    await vi.waitFor(() => expect(total()).toBe('100,00 €'))

    await deposit('50,25')

    // El saldo nou és el que retorna el backend, sense tornar a demanar-lo
    expect(total()).toBe('150,25 €')
    expect(calls('GET', '/account/balance')).toHaveLength(1)
    const [[, init]] = calls('POST', '/account/deposits')
    expect(JSON.parse(init.body)).toEqual({ amount: '50.25' })

    await navLink('Historial').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="movement-row"]')).toHaveLength(1))
    const row = wrapper.find('[data-test="movement-row"]')
    expect(row.text()).toContain('Ingrés de diners')
    expect(text(row.find('[data-test="movement-amount"]'))).toBe('+50,25 €')
    expect(row.find('[data-test="movement-amount"]').classes()).toContain('movements__amount--in')
    expect(text(row.find('[data-test="movement-balance"]'))).toContain('150,25 €')
  })

  it.each([
    ['0,99', "L'import mínim d'ingrés és d'1 €."],
    ['10000,01', "L'import màxim per operació és de 10.000 €."],
  ])('un ingrés de %s € es rebutja amb el missatge del criteri', async (amount, message) => {
    await mountAt('/compte-efectiu')

    await deposit(amount)

    expect(text(wrapper)).toContain(message)
    expect(total()).toBe('100,00 €')
    expect(calls('POST', '/account/deposits')).toHaveLength(0)
  })

  it('si la base de dades falla, el saldo no canvia i es mostra el missatge del criteri', async () => {
    backend.failDeposits = true
    await mountAt('/compte-efectiu')

    await deposit('50')

    expect(wrapper.text()).toContain("No s'ha pogut processar el dipòsit. El teu saldo no ha canviat.")
    expect(total()).toBe('100,00 €')
  })

  it("sense moviments, l'historial mostra el missatge del criteri", async () => {
    await mountAt('/historial')

    await vi.waitFor(() =>
      expect(wrapper.find('[data-test="movements-empty"]').text()).toBe(
        "No s'han trobat moviments per als filtres seleccionats."
      )
    )
  })

  it.each(['/compte-efectiu', '/historial'])(
    "l'usuari no verificat veu a %s l'avís per verificar-se, que porta a l'onboarding",
    async (path) => {
      backend.verified = false
      await mountAt(path)

      const notice = wrapper.find('[data-test="verification-required"]')
      expect(notice.text()).toContain('Compte no verificat')
      expect(wrapper.find('form').exists()).toBe(false)
      // No es demana res del compte: l'estat de verificació ja diu que no pot operar
      expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/users/me'))).toBe(true)

      await notice.findAll('button').find((b) => b.text() === "Verifica't").trigger('click')
      await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/onboarding'))
    }
  )
})

describe('Acceptació Sprint 2: retirada amb PIN (US3.3 + US1.5 + US3.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    backend = createBackend()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it("sense IBAN la targeta el demana primer, rebutja un IBAN invàlid i mostra l'emmascarat", async () => {
    backend.iban = null
    await mountAt('/compte-efectiu')

    const ibanInput = await vi.waitFor(() => wrapper.get('[data-test="withdrawal-iban"]'))
    expect(wrapper.text()).toContain('És una simulació: fes servir un IBAN de prova.')
    expect(wrapper.find('[data-test="withdrawal-amount"]').exists()).toBe(false)

    await ibanInput.setValue('ES00 0000 0000 0000 0000 0000')
    await formWith('[data-test="withdrawal-iban"]').trigger('submit')
    expect(wrapper.text()).toContain('El codi IBAN no és vàlid.')
    expect(calls('PUT', '/profile/iban')).toHaveLength(0)

    // Amb espais també s'accepta, i s'envia net
    await ibanInput.setValue('ES91 2100 0418 4502 0005 1332')
    await formWith('[data-test="withdrawal-iban"]').trigger('submit')
    await flushPromises()
    expect(JSON.parse(calls('PUT', '/profile/iban')[0][1].body)).toEqual({ iban: 'ES9121000418450200051332' })
    expect(wrapper.get('[data-test="withdrawal-iban-masked"]').text()).toBe(MASKED_IBAN)
    expect(buttonText('Canvia').exists()).toBe(true)
  })

  it("amb el PIN correcte el saldo baixa a l'instant i la retirada apareix a l'historial", async () => {
    await mountAt('/compte-efectiu')
    await vi.waitFor(() => expect(total()).toBe('100,00 €'))

    await withdraw('30', '1234')

    expect(total()).toBe('70,00 €')
    expect(text(wrapper.get('[data-test="withdrawal-success"]'))).toBe("S'han retirat 30,00 € del compte.")
    const [[, init]] = calls('POST', '/account/withdrawals')
    expect(init.headers['X-PIN']).toBe('1234')
    expect(JSON.parse(init.body)).toEqual({ amount: '30' })

    await navLink('Historial').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="movement-row"]')).toHaveLength(1))
    const row = wrapper.find('[data-test="movement-row"]')
    expect(row.text()).toContain('Retirada a ES•• 1332')
    expect(text(row.find('[data-test="movement-amount"]'))).toBe('−30,00 €')
    expect(row.find('[data-test="movement-amount"]').classes()).toContain('movements__amount--out')
  })

  it('amb el PIN incorrecte la retirada no es fa i es pot tornar a provar', async () => {
    await mountAt('/compte-efectiu')

    await withdraw('30', '0000')

    expect(wrapper.text()).toContain('El PIN introduït és incorrecte.')
    expect(total()).toBe('100,00 €')
    expect(backend.movements).toHaveLength(0)
    // El pas del PIN es queda obert i buit
    expect(wrapper.get('[data-test="pin-input"]').element.value).toBe('')
  })

  it.each([
    ['150', "Saldo insuficient. Et falten 50,00 € per completar l'operació"],
    ['0,99', "L'import mínim de retirada és d'1 €."],
  ])('una retirada de %s € es rebutja abans de demanar el PIN', async (amount, message) => {
    await mountAt('/compte-efectiu')
    await vi.waitFor(() => expect(total()).toBe('100,00 €'))

    await withdraw(amount)

    expect(text(wrapper)).toContain(message)
    expect(wrapper.find('[data-test="pin-dialog"]').exists()).toBe(false)
    expect(calls('POST', '/account/withdrawals')).toHaveLength(0)
  })

  it('sense PIN configurat no es pot confirmar i porta al perfil', async () => {
    backend.pin = null
    await mountAt('/compte-efectiu')

    // El diàleg avisa abans d'escriure el PIN
    await withdraw('30')

    expect(wrapper.get('[data-test="pin-missing"]').text()).toContain(
      'Cal configurar el PIN de seguretat al perfil per fer aquesta operació.',
    )
    expect(wrapper.find('[data-test="pin-input"]').exists()).toBe(false)
    expect(calls('POST', '/account/withdrawals')).toHaveLength(0)
    await wrapper.get('[data-test="pin-go-profile"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/perfil'))
  })

  it('si no es pot validar el PIN, la retirada no es fa', async () => {
    backend.pinCheckFails = true
    await mountAt('/compte-efectiu')

    await withdraw('30', '1234')

    expect(wrapper.text()).toContain("No s'ha pogut validar el PIN de seguretat. Torna-ho a provar més tard.")
    expect(total()).toBe('100,00 €')
  })
})

describe('Acceptació Sprint 2: cercar actius (US5.1 + US5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    // Cercar no és operar: el cercador ha de funcionar sense estar verificat
    backend = createBackend({ verified: false })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  const names = () => wrapper.findAll('[data-test="asset-result"]').map((r) => r.find('.assets__name').text())

  async function search(text) {
    await wrapper.get('[data-test="asset-search"]').setValue(text)
    // El cercador espera que l'usuari pari d'escriure abans de demanar res
    await vi.waitFor(() => expect(String(fetchMock.mock.lastCall[0])).toContain(`q=${encodeURIComponent(text.trim())}`))
    await flushPromises()
  }

  it("sense text mostra tot el catàleg ordenat per nom, amb ticker i tipus", async () => {
    await mountAt('/actius')

    await vi.waitFor(() => expect(names()).toEqual(['Apple Inc.', 'iShares Core MSCI World', 'Microsoft Corp.']))
    const [apple, ishares] = wrapper.findAll('[data-test="asset-result"]')
    expect(apple.text()).toContain('AAPL')
    expect(apple.text()).toContain('Acció')
    expect(ishares.text()).toContain('ETF')
  })

  it('filtra pel nom o el ticker i, sense coincidències, mostra el missatge del criteri', async () => {
    await mountAt('/actius')
    await vi.waitFor(() => expect(names()).toHaveLength(3))

    await search('  ms ')
    expect(names()).toEqual(['iShares Core MSCI World', 'Microsoft Corp.'])

    await search('zzz')
    expect(wrapper.find('[data-test="no-results"]').text()).toBe("No s'han trobat actius")
  })

  // shortcut: el frontend encara no mostra preu ni variació (#125); treure el skip quan entri
  it.skip('cada resultat mostra el preu, la data i la variació diària, i que els preus són simulats', async () => {
    Object.assign(backend.catalog[1], { close_price_eur: 182.5, daily_change_pct: 1.25, price_date: '2026-11-20' })
    await mountAt('/actius')

    await vi.waitFor(() => expect(names()).toHaveLength(3))
    const apple = wrapper.findAll('[data-test="asset-result"]')[0]
    expect(text(apple)).toContain('182,50 €')
    expect(text(apple)).toContain('+1,25 %')
    // Els actius sense cotització al catàleg
    expect(wrapper.findAll('[data-test="asset-result"]')[1].text()).toContain('No disponible')
    expect(wrapper.text()).toContain('Preus simulats')
  })
})
