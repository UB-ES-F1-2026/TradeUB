import { apiGet, apiPost } from './api'

// Estat de la verificació simulada del DNI i dels termes (US2.4), tal com el retorna el backend.
// Temporal: quan s'assembli la US2.4, TermsView, ActiusView i PerfilView el llegiran de la store
// `verification` del selector del DNI i aquest servei es podrà esborrar
export const IDENTITY_VERIFIED = 'verificat'

// Llegeix el camp verificacio de GET /users/me (null si el backend encara no el retorna)
export async function fetchVerification() {
  const data = await apiGet('/users/me')
  return data?.verificacio ?? null
}

// Accepta la versió vigent dels termes. El backend respon 409 si la identitat no està verificada
// o si la versió no és la vigent; en aquest cas es llança l'ApiError
export async function acceptTerms(versio) {
  const data = await apiPost('/profile/terms', { versio })
  return data?.verificacio ?? null
}

export const isIdentityVerified = (verificacio) => verificacio?.estat === IDENTITY_VERIFIED

// Mateix criteri que require_verified_user al backend: identitat verificada i termes vigents acceptats
export const canOperate = (verificacio) =>
  isIdentityVerified(verificacio) && verificacio?.termes_acceptats === true
