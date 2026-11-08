import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

import { supabase } from '../services/supabase'
import { ApiError, apiRequest } from '../services/api'

const API_URL = 'http://api.test/api/v1'

function mockSession(session) {
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null })
}

function mockFetch(status, payload) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('apiRequest', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', API_URL)
    mockSession({ access_token: 'token-de-prova' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('crida VITE_API_URL amb el token de la sessió i retorna el JSON', async () => {
    const fetchMock = mockFetch(200, { perfil: {} })

    const result = await apiRequest('/users/me')

    expect(result).toEqual({ perfil: {} })
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/users/me`, {
      method: 'GET',
      headers: { Authorization: 'Bearer token-de-prova' },
      body: undefined,
    })
  })

  it('envia el cos com a JSON', async () => {
    const fetchMock = mockFetch(200, {})

    await apiRequest('/users/me', { method: 'POST', body: { nom: 'Ivan' } })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe(JSON.stringify({ nom: 'Ivan' }))
  })

  it('no envia la capçalera Authorization sense sessió', async () => {
    mockSession(null)
    const fetchMock = mockFetch(200, {})

    await apiRequest('/users/me')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers).not.toHaveProperty('Authorization')
  })

  it("llança un ApiError amb el codi i el detall si la resposta no és correcta", async () => {
    mockFetch(401, { detail: 'Token invàlid' })

    const error = await apiRequest('/users/me').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Token invàlid')
  })

  it('llança un ApiError encara que la resposta d\'error no porti JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError('Unexpected token') },
    }))

    const error = await apiRequest('/users/me').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(500)
  })
})
