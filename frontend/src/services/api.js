import { useAuthStore } from '../stores/auth'

const apiUrl = import.meta.env.VITE_API_URL

// Error de l'API amb el codi HTTP i el detail que retorna FastAPI
export class ApiError extends Error {
  constructor(status, detail) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
  }
}

// Petició al backend amb el token de la sessió de Supabase (el backend el valida a deps.py)
async function request(path, init = {}) {
  const authStore = useAuthStore()
  const token = authStore.session?.access_token
  if (!token) throw new ApiError(401, 'Cal iniciar sessió')

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    // FastAPI retorna el detail com a text, o com a llista si la validació de Pydantic falla
    const detail = typeof body?.detail === 'string' ? body.detail : 'Error del servidor'
    throw new ApiError(response.status, detail)
  }
  return body
}

export const apiGet = (path) => request(path)

export const apiPost = (path, data) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
