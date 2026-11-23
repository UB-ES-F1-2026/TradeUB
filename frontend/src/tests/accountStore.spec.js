import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))

import { apiGet, apiPost, apiPut, ApiError } from '../services/api'
import { useAccountStore } from '../stores/account'
import { useAuthStore } from '../stores/auth'

const account = { balance: 10000, currency: 'EUR', updated_at: '2026-11-01T10:00:00+00:00' }

describe('account store', () => {
  let store
  let authStore

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    authStore = useAuthStore()
    authStore.user = { id: 'u1' }
    store = useAccountStore()
  })

  it('comença sense saldo', () => {
    expect(store.balance).toBeNull()
    expect(store.hasBalance).toBe(false)
  })

  it('carrega el saldo del backend', async () => {
    apiGet.mockResolvedValue(account)

    await store.fetchBalance()

    expect(apiGet).toHaveBeenCalledWith('/account/balance')
    expect(store.balance).toBe(10000)
    expect(store.currency).toBe('EUR')
    expect(store.updatedAt).toBe(account.updated_at)
    expect(store.hasBalance).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('converteix a número el saldo que arriba com a text', async () => {
    apiGet.mockResolvedValue({ ...account, balance: '2500.50' })

    await store.fetchBalance()

    expect(store.balance).toBe(2500.5)
  })

  it("marca loading mentre espera la resposta", async () => {
    let resolve
    apiGet.mockReturnValue(new Promise((r) => { resolve = r }))

    const pending = store.fetchBalance()
    expect(store.loading).toBe(true)

    resolve(account)
    await pending
    expect(store.loading).toBe(false)
  })

  it('sense compte mostra un missatge propi', async () => {
    apiGet.mockRejectedValue(new ApiError(404, 'Compte no trobat'))

    await store.fetchBalance()

    expect(store.error).toBe('Encara no tens cap compte virtual.')
    expect(store.hasBalance).toBe(false)
  })

  it("sense verificar buida el saldo i mostra el missatge del servidor", async () => {
    apiGet.mockResolvedValueOnce(account)
    await store.fetchBalance()
    const detail = 'Cal verificar la identitat i acceptar els termes per operar'
    apiGet.mockRejectedValueOnce(new ApiError(403, detail))

    await store.fetchBalance()

    expect(store.hasBalance).toBe(false)
    expect(store.error).toBe(detail)
    expect(store.loading).toBe(false)
  })

  it("si falla manté l'últim saldo i mostra l'error", async () => {
    apiGet.mockResolvedValueOnce(account)
    await store.fetchBalance()
    apiGet.mockRejectedValueOnce(new ApiError(500, 'No s\'ha pogut recuperar el saldo'))

    await store.fetchBalance()

    expect(store.balance).toBe(10000)
    expect(store.error).toBe("No s'ha pogut carregar el saldo. Torna-ho a provar.")
  })

  it("ingressa l'import i desa el saldo que retorna el backend", async () => {
    apiGet.mockResolvedValue(account)
    await store.fetchBalance()
    apiPost.mockResolvedValue({ balance: '10050.25' })

    await store.deposit('50.25')

    expect(apiPost).toHaveBeenCalledWith('/account/deposits', { amount: '50.25' })
    expect(store.balance).toBe(10050.25)
  })

  it("si l'ingrés falla, llança l'error i el saldo no canvia", async () => {
    apiGet.mockResolvedValue(account)
    await store.fetchBalance()
    const failure = new ApiError(500, "No s'ha pogut processar el dipòsit. El teu saldo no ha canviat.")
    apiPost.mockRejectedValue(failure)

    await expect(store.deposit('50')).rejects.toBe(failure)
    expect(store.balance).toBe(10000)
  })

  it("llegeix l'IBAN emmascarat del perfil", async () => {
    apiGet.mockResolvedValue({ perfil: { iban_emmascarat: 'ES•• •••• •••• •••• •••• 1332' } })

    await store.loadIban()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(store.ibanMasked).toBe('ES•• •••• •••• •••• •••• 1332')
  })

  it('sense IBAN vinculat queda a null', async () => {
    apiGet.mockResolvedValue({ perfil: { iban_emmascarat: null } })

    await store.loadIban()

    expect(store.ibanMasked).toBeNull()
  })

  it("vincula l'IBAN i desa l'emmascarat que retorna el backend", async () => {
    apiPut.mockResolvedValue({ iban_emmascarat: 'ES•• •••• •••• •••• •••• 1332' })

    await store.linkIban('ES9121000418450200051332')

    expect(apiPut).toHaveBeenCalledWith('/profile/iban', { iban: 'ES9121000418450200051332' })
    expect(store.ibanMasked).toBe('ES•• •••• •••• •••• •••• 1332')
  })

  it('retira amb el PIN a la capçalera i desa el saldo nou', async () => {
    apiGet.mockResolvedValue(account)
    await store.fetchBalance()
    apiPost.mockResolvedValue({ balance: '9949.75' })

    await store.withdraw('50.25', '1234')

    expect(apiPost).toHaveBeenCalledWith('/account/withdrawals', { amount: '50.25' }, { 'X-PIN': '1234' })
    expect(store.balance).toBe(9949.75)
  })

  it("si la retirada falla, llança l'error i el saldo no canvia", async () => {
    apiGet.mockResolvedValue(account)
    await store.fetchBalance()
    const failure = new ApiError(403, 'El PIN introduït és incorrecte.')
    apiPost.mockRejectedValue(failure)

    await expect(store.withdraw('50', '0000')).rejects.toBe(failure)
    expect(store.balance).toBe(10000)
  })

  it("buida el saldo i l'IBAN quan es tanca la sessió o canvia l'usuari", async () => {
    apiGet.mockResolvedValue(account)
    await store.fetchBalance()
    store.ibanMasked = 'ES•• •••• •••• •••• •••• 1332'

    authStore.user = null
    await nextTick()

    expect(store.balance).toBeNull()
    expect(store.ibanMasked).toBeNull()
    expect(store.error).toBe('')
  })
})
