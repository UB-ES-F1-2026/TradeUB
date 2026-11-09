import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Supabase i API falsos: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost, ApiError } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { MAX_RECHECKS, RECHECK_DELAY_MS, useVerificationStore } from '../stores/verification'

const NOW = new Date('2026-11-09T10:00:00Z')

// Respostes del backend segons el contracte de US2.4
const pending = () => ({ verificacio: { estat: 'pendent', document_enviat_at: null } })
const inReview = (sentAt = NOW.toISOString()) => ({ verificacio: { estat: 'en-revisio', document_enviat_at: sentAt } })
const verified = () => ({ verificacio: { estat: 'verificat', document_enviat_at: NOW.toISOString() } })

describe('verification store', () => {
  let store

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useVerificationStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('load llegeix l\'estat de GET /users/me', async () => {
    apiGet.mockResolvedValue(pending())

    await store.load()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(store.isPending).toBe(true)
    expect(store.error).toBe('')
  })

  it('sense camp verificacio o amb un estat desconegut, queda pendent', async () => {
    apiGet.mockResolvedValue({ verificacio: { estat: 'inventat' } })
    await store.load()
    expect(store.isPending).toBe(true)

    apiGet.mockResolvedValue({})
    await store.load()
    expect(store.isPending).toBe(true)
  })

  it('si load falla, mostra un error', async () => {
    apiGet.mockRejectedValue(new ApiError(500, 'Error del servidor'))

    await store.load()

    expect(store.error).toBe("No s'ha pogut comprovar l'estat de la verificació.")
    expect(store.loading).toBe(false)
  })

  it('submitDocument avisa el backend sense enviar la imatge i comença el compte enrere', async () => {
    apiPost.mockResolvedValue(inReview())

    await store.submitDocument()

    expect(apiPost).toHaveBeenCalledWith('/profile/identity-document')
    expect(store.isInReview).toBe(true)
    expect(store.secondsLeft).toBe(15)

    await vi.advanceTimersByTimeAsync(5000)
    expect(store.secondsLeft).toBe(10)
  })

  it('en acabar el compte enrere demana l\'estat real a GET /users/me', async () => {
    apiPost.mockResolvedValue(inReview())
    apiGet.mockResolvedValue(verified())
    await store.submitDocument()

    await vi.advanceTimersByTimeAsync(14000)
    expect(apiGet).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(store.isVerified).toBe(true)
    expect(store.checking).toBe(false)
  })

  it('si el backend encara el té en revisió, torna a preguntar al cap d\'una estona', async () => {
    apiPost.mockResolvedValue(inReview())
    apiGet.mockResolvedValueOnce(inReview()).mockResolvedValue(verified())
    await store.submitDocument()

    await vi.advanceTimersByTimeAsync(15000)
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(store.isInReview).toBe(true)
    expect(store.checking).toBe(true)

    await vi.advanceTimersByTimeAsync(RECHECK_DELAY_MS)
    expect(apiGet).toHaveBeenCalledTimes(2)
    expect(store.isVerified).toBe(true)
  })

  it('deixa de preguntar després d\'uns quants intents i mostra un error', async () => {
    apiPost.mockResolvedValue(inReview())
    apiGet.mockResolvedValue(inReview())
    await store.submitDocument()

    await vi.advanceTimersByTimeAsync(15000 + RECHECK_DELAY_MS * (MAX_RECHECKS + 2))

    expect(apiGet).toHaveBeenCalledTimes(MAX_RECHECKS + 1)
    expect(store.checking).toBe(false)
    expect(store.error).toBe("No s'ha pogut comprovar l'estat de la verificació.")
  })

  it('si l\'enviament falla, llança l\'error i continua pendent', async () => {
    const apiError = new ApiError(500, 'Error del servidor')
    apiPost.mockRejectedValue(apiError)

    await expect(store.submitDocument()).rejects.toBe(apiError)

    expect(store.isPending).toBe(true)
  })

  it('en tornar a la pàgina amb el document en revisió reprèn el compte enrere', async () => {
    const sentAt = new Date(NOW.getTime() - 6000).toISOString()
    apiGet.mockResolvedValueOnce(inReview(sentAt)).mockResolvedValue(verified())

    await store.load()
    expect(store.secondsLeft).toBe(9)

    await vi.advanceTimersByTimeAsync(9000)
    expect(store.isVerified).toBe(true)
  })

  it('en canviar d\'usuari s\'esborra la verificació de l\'anterior', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'u1' }
    apiPost.mockResolvedValue(inReview())
    await store.submitDocument()

    auth.user = { id: 'u2' }
    await Promise.resolve()

    expect(store.isPending).toBe(true)
    expect(store.secondsLeft).toBe(0)
    await vi.advanceTimersByTimeAsync(20000)
    expect(apiGet).not.toHaveBeenCalled()
  })
})
