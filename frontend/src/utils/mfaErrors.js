// Tradueix els errors de Supabase MFA a missatges en català
export function mfaErrorMessage(err) {
  switch (err?.code) {
    case 'mfa_verification_failed':
      return "El codi d'autenticació és incorrecte."
    case 'mfa_challenge_expired':
      return 'El codi ha caducat. Introdueix el codi actual de l\'aplicació.'
    case 'over_request_rate_limit':
      return 'Massa intents seguits. Espera uns minuts i torna-ho a provar.'
    case 'mfa_totp_enroll_not_enabled':
    case 'mfa_totp_verify_not_enabled':
      return 'La verificació en dos passos no està disponible ara mateix.'
  }
  if (err?.name === 'AuthRetryableFetchError') {
    return "No s'ha pogut connectar amb el servidor. Comprova la connexió."
  }
  return "No s'ha pogut completar la verificació. Torna-ho a provar."
}

// El codi TOTP són 6 xifres; s'accepten espais (p. ex. "123 456")
export function normalizeTotpCode(value) {
  return value.replace(/\s/g, '')
}

export function isValidTotpCode(code) {
  return /^\d{6}$/.test(code)
}
