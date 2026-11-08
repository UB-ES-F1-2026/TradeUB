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

// GET al backend amb el token de la sessió de Supabase (el backend el valida a deps.py)
export async function apiGet(path) {
  const authStore = useAuthStore()
  const token = authStore.session?.access_token
  if (!token) throw new ApiError(401, 'Cal iniciar sessió')

  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body?.detail ?? 'Error del servidor')
  return body
}
