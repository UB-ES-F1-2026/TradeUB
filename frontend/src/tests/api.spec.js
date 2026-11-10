import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))

import { apiGet, apiPost, ApiError } from '../services/api'
import { useAuthStore } from '../stores/auth'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('apiGet', () => {
  let fetchSpy

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('envia el token de la sessió i retorna el cos', async () => {
    useAuthStore().session = { access_token: 'token-prova' }
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }))

    const body = await apiGet('/account/balance')

    expect(body).toEqual({ ok: true })
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toMatch(/\/account\/balance$/)
    expect(options.headers.Authorization).toBe('Bearer token-prova')
  })

  it('sense sessió no fa la crida i llança un 401', async () => {
    await expect(apiGet('/account/balance')).rejects.toMatchObject({ status: 401 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("llança un ApiError amb el codi i el detail de l'API", async () => {
    useAuthStore().session = { access_token: 'token-prova' }
    fetchSpy.mockResolvedValue(jsonResponse({ detail: 'Compte no trobat' }, 404))

    const error = await apiGet('/account/balance').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Compte no trobat')
  })
})

describe('apiPost', () => {
  let fetchSpy

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().session = { access_token: 'token-prova' }
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('envia el cos en JSON amb el token de la sessió', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }))

    const body = await apiPost('/profile/personal-data', { nif: '12345678Z' })

    expect(body).toEqual({ ok: true })
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toMatch(/\/profile\/personal-data$/)
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer token-prova')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ nif: '12345678Z' })
  })

  it("llança un ApiError amb el missatge de l'API si el backend rebutja les dades", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ detail: 'El format del NIF/NIE no és vàlid.' }, 422))

    const error = await apiPost('/profile/personal-data', {}).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.message).toBe('El format del NIF/NIE no és vàlid.')
  })

  it('si el detail és una llista de Pydantic, usa un missatge genèric', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ detail: [{ loc: ['body', 'nif'], msg: 'Field required' }] }, 422))

    const error = await apiPost('/profile/personal-data', {}).catch((e) => e)

    expect(error.message).toBe('Error del servidor')
  })

  it('sense sessió no fa la crida', async () => {
    useAuthStore().session = null

    await expect(apiPost('/profile/personal-data', {})).rejects.toMatchObject({ status: 401 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
