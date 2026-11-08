import { supabase } from './supabase'

// Error d'una crida a l'API amb el codi HTTP, perquè cada vista decideixi quin missatge mostrar
export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : `Error ${status} de l'API`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// Crida el backend (VITE_API_URL) amb el token de la sessió de Supabase i retorna el JSON de la resposta.
// El token es demana a Supabase a cada crida perquè el client ja el refresca quan caduca.
export async function apiRequest(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Algunes respostes d'error poden no portar JSON
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, payload?.detail)
  return payload
}
