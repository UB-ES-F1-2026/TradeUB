import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet, ApiError } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { DATE_RANGE_ERROR, useMovementsStore } from '../stores/movements'

const movement = {
  created_at: '2026-11-13T12:00:00+00:00',
  concept: 'Ingrés de diners',
  amount: '250.00',
  type: 'ingres',
  balance_after: '1250.00',
}

// Paràmetres de la consulta de l'última crida a l'API
const lastQuery = () => {
  const path = apiGet.mock.calls.at(-1)[0]
  expect(path.startsWith('/account/movements?')).toBe(true)
  return Object.fromEntries(new URLSearchParams(path.split('?')[1]))
}

describe('movements store', () => {
  let store
  let authStore

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    authStore = useAuthStore()
    authStore.user = { id: 'u1' }
    store = useMovementsStore()
  })

  it('sense filtres demana la primera pàgina de 20 sense dates ni tipus', async () => {
    apiGet.mockResolvedValue({ movements: [movement], has_more: false })

    await store.fetchMovements()

    expect(lastQuery()).toEqual({ limit: '20', offset: '0' })
    expect(store.movements).toEqual([movement])
    expect(store.hasMore).toBe(false)
    expect(store.error).toBe('')
  })

  it('envia les dates i el tipus seleccionats', async () => {
    apiGet.mockResolvedValue({ movements: [], has_more: false })
    Object.assign(store.filters, { from: '2026-10-01', to: '2026-10-31', type: 'retirada' })

    await store.applyFilters()

    expect(lastQuery()).toEqual({
      limit: '20', offset: '0', from: '2026-10-01', to: '2026-10-31', type: 'retirada',
    })
  })

  it('amb has_more passa a la pàgina següent i torna enrere', async () => {
    apiGet.mockResolvedValue({ movements: [movement], has_more: true })
    await store.fetchMovements()

    await store.nextPage()
    expect(store.page).toBe(2)
    expect(lastQuery().offset).toBe('20')

    await store.prevPage()
    expect(store.page).toBe(1)
    expect(lastQuery().offset).toBe('0')
  })

  it('no avança sense has_more ni retrocedeix des de la primera pàgina', async () => {
    apiGet.mockResolvedValue({ movements: [movement], has_more: false })
    await store.fetchMovements()
    apiGet.mockClear()

    await store.nextPage()
    await store.prevPage()

    expect(store.page).toBe(1)
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('canviar els filtres torna a la primera pàgina', async () => {
    apiGet.mockResolvedValue({ movements: [movement], has_more: true })
    await store.fetchMovements()
    await store.nextPage()

    store.filters.type = 'ingres'
    await store.applyFilters()

    expect(store.page).toBe(1)
    expect(lastQuery()).toMatchObject({ offset: '0', type: 'ingres' })
  })

  it('amb la data inici posterior a la data fi no crida el backend', async () => {
    Object.assign(store.filters, { from: '2026-11-10', to: '2026-11-01' })

    await store.applyFilters()

    expect(store.dateRangeError).toBe(DATE_RANGE_ERROR)
    expect(apiGet).not.toHaveBeenCalled()
    expect(store.movements).toEqual([])
  })

  it('mostra el missatge del backend en un 422', async () => {
    apiGet.mockRejectedValue(new ApiError(422, DATE_RANGE_ERROR))

    await store.fetchMovements()

    expect(store.error).toBe(DATE_RANGE_ERROR)
  })

  it('qualsevol altre error mostra un missatge genèric', async () => {
    apiGet.mockRejectedValue(new ApiError(500, "No s'ha pogut recuperar l'historial"))

    await store.fetchMovements()

    expect(store.error).toBe("No s'ha pogut carregar l'historial. Torna-ho a provar.")
    expect(store.movements).toEqual([])
    expect(store.loading).toBe(false)
  })

  it("ignora una resposta que arriba després d'una petició més nova", async () => {
    let resolveOld
    apiGet.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    const old = store.fetchMovements()

    apiGet.mockResolvedValueOnce({ movements: [], has_more: false })
    store.filters.type = 'retirada'
    await store.applyFilters()

    resolveOld({ movements: [movement], has_more: true })
    await old

    expect(store.movements).toEqual([])
    expect(store.hasMore).toBe(false)
  })

  it("en canviar d'usuari esborra els moviments i els filtres", async () => {
    apiGet.mockResolvedValue({ movements: [movement], has_more: true })
    store.filters.type = 'ingres'
    await store.fetchMovements()
    await store.nextPage()

    authStore.user = { id: 'u2' }
    await nextTick()

    expect(store.movements).toEqual([])
    expect(store.page).toBe(1)
    expect(store.filters.type).toBe('tots')
  })
})
