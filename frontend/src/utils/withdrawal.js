import { formatCurrency } from './currency'
import { DEPOSIT_FORMAT_ERROR, parseAmount } from './deposit'

// Límit de cada retirada (US3.3). El màxim és el saldo disponible, que el backend torna a comprovar a
// POST /account/withdrawals
export const MIN_WITHDRAWAL = 1

export const WITHDRAWAL_REQUIRED_ERROR = "Introdueix l'import que vols retirar."
export const WITHDRAWAL_FORMAT_ERROR = DEPOSIT_FORMAT_ERROR
export const WITHDRAWAL_MIN_ERROR = "L'import mínim de retirada és d'1 €."
export const WITHDRAWAL_FAILED_ERROR = "No s'ha pogut processar la retirada. El teu saldo no ha canviat."
// Inici del missatge de saldo insuficient, tant el del frontend com el que retorna el backend
export const INSUFFICIENT_BALANCE_PREFIX = 'Saldo insuficient.'

// Errors del PIN de seguretat (require_pin al backend, US1.5)
export const PIN_FORMAT_ERROR = 'El PIN ha de tenir 4 dígits.'
export const PIN_INCORRECT_ERROR = 'El PIN introduït és incorrecte.'
export const PIN_NOT_CONFIGURED_ERROR = 'Cal configurar el PIN de seguretat al perfil per fer aquesta operació.'
export const PIN_CHECK_FAILED_ERROR = "No s'ha pogut validar el PIN de seguretat. Torna-ho a provar més tard."
// Detail dels 500 de require_pin quan no es pot llegir o comprovar el PIN desat
const PIN_SERVER_ERRORS = ["No s'ha pogut recuperar el PIN", "No s'ha pogut comprovar el PIN"]

export const IBAN_HINT = 'És una simulació: fes servir un IBAN de prova.'
export const IBAN_INVALID_ERROR = 'El codi IBAN no és vàlid.'
export const IBAN_SAVE_FAILED_ERROR = "No s'ha pogut desar l'IBAN. Torna-ho a provar."
// El backend rebutja la retirada si no hi ha IBAN vinculat (per exemple, si s'ha esborrat des d'una altra pestanya)
export const NO_IBAN_ERROR = 'Cal vincular un IBAN per retirar diners.'
export const IBAN_LOAD_ERROR = "No s'ha pogut carregar l'IBAN vinculat. Torna-ho a provar."

// Text literal del criteri d'acceptació, sense punt final
export function insufficientBalanceError(missing, currency = 'EUR') {
  return `${INSUFFICIENT_BALANCE_PREFIX} Et falten ${formatCurrency(missing, currency)} per completar l'operació`
}

// Diferència en euros calculada en cèntims, perquè 10.1 - 10 no doni 0.0999…
function missingAmount(amount, balance) {
  return (Math.round(amount * 100) - Math.round(balance * 100)) / 100
}

// Error de l'import escrit, o '' si es pot enviar. Amb el saldo desconegut (null), només el backend comprova
// si n'hi ha prou
export function withdrawalError(text, balance = null, currency = 'EUR') {
  if (!text.trim()) return WITHDRAWAL_REQUIRED_ERROR
  const amount = parseAmount(text)
  if (amount === null) return WITHDRAWAL_FORMAT_ERROR
  if (Number(amount) < MIN_WITHDRAWAL) return WITHDRAWAL_MIN_ERROR
  if (balance !== null && Number(amount) > balance) {
    return insufficientBalanceError(missingAmount(Number(amount), balance), currency)
  }
  return ''
}

export function isValidPin(text) {
  return /^[0-9]{4}$/.test(text)
}

// Text del PIN que s'ha de mostrar al diàleg segons l'error del backend, o '' si l'error no és del PIN
export function pinErrorMessage(status, detail) {
  if (status === 403 && [PIN_INCORRECT_ERROR, PIN_NOT_CONFIGURED_ERROR].includes(detail)) return detail
  if (status === 500 && PIN_SERVER_ERRORS.includes(detail)) return PIN_CHECK_FAILED_ERROR
  return ''
}

// L'IBAN s'escriu amb o sense espais; s'envia net i en majúscules
export function normalizeIban(text) {
  return text.replace(/\s+/g, '').toUpperCase()
}

// Mateixa regla que el backend (#134): IBAN espanyol (ES + 22 xifres) amb el dígit de control mod 97 correcte
export function isValidIban(text) {
  const iban = normalizeIban(text)
  if (!/^ES[0-9]{22}$/.test(iban)) return false
  // Es mouen els 4 primers caràcters al final i cada lletra passa a número (A=10 … Z=35)
  const digits = [...(iban.slice(4) + iban.slice(0, 4))].map((char) => parseInt(char, 36)).join('')
  // El número no cap en un Number: el residu es calcula xifra a xifra
  let remainder = 0
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}
