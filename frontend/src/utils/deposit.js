// Límits de cada ingrés (US3.2). Són els mateixos que comprova el backend a POST /account/deposits
export const MIN_DEPOSIT = 1
export const MAX_DEPOSIT = 10000

export const DEPOSIT_REQUIRED_ERROR = "Introdueix l'import que vols ingressar."
export const DEPOSIT_FORMAT_ERROR = 'Introdueix un import en euros amb dos decimals com a màxim.'
export const DEPOSIT_MIN_ERROR = "L'import mínim d'ingrés és d'1 €."
export const DEPOSIT_MAX_ERROR = "L'import màxim per operació és de 10.000 €."
export const DEPOSIT_FAILED_ERROR = "No s'ha pogut processar el dipòsit. El teu saldo no ha canviat."

// Xifres amb coma o punt decimal i dos decimals com a màxim: "50", "50,5", "50.25"
const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/

// Converteix el text del camp en l'import que s'envia al backend ("50,25" -> "50.25").
// Torna null si el format no és vàlid
export function parseAmount(text) {
  const value = text.trim()
  if (!AMOUNT_PATTERN.test(value)) return null
  return value.replace(',', '.')
}

// Error de l'import escrit, o '' si es pot enviar
export function depositError(text) {
  if (!text.trim()) return DEPOSIT_REQUIRED_ERROR
  const amount = parseAmount(text)
  if (amount === null) return DEPOSIT_FORMAT_ERROR
  if (Number(amount) < MIN_DEPOSIT) return DEPOSIT_MIN_ERROR
  if (Number(amount) > MAX_DEPOSIT) return DEPOSIT_MAX_ERROR
  return ''
}
