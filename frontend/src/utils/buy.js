// Compra d'un actiu simulat (US6.1). El càlcul és el mateix que fa buy_asset al backend (#126): aquí només serveix
// per mostrar la revisió del cost abans de confirmar. L'import que es cobra de veritat el decideix el backend
// amb el preu del catàleg

// La comissió és l'1% del cost, arrodonit a l'alça al cèntim, amb un màxim d'1 €
export const COMMISSION_RATE_PCT = 1
export const MAX_COMMISSION_CENTS = 100

export const UNITS_REQUIRED_ERROR = 'Introdueix les unitats que vols comprar.'
// Mateix text que retorna el backend (INVALID_UNITS_ERROR a api/orders.py)
export const UNITS_FORMAT_ERROR = 'Les unitats han de ser un nombre enter positiu.'
// Textos que retorna POST /orders/buy (api/orders.py)
export const BUY_INSUFFICIENT_BALANCE_ERROR = 'No tens saldo suficient per fer aquesta compra.'
export const BUY_FAILED_ERROR = "No s'ha pogut processar la compra. El teu saldo no ha canviat."

// Només unitats enteres (#126): "3" sí; "1,5", "0" o "-2" no
const UNITS_PATTERN = /^\d+$/

// Converteix el text del camp en les unitats que s'envien al backend. Torna null si no és un enter positiu
export function parseUnits(text) {
  const value = (text ?? '').trim()
  if (!UNITS_PATTERN.test(value)) return null
  const units = Number(value)
  return units > 0 && Number.isSafeInteger(units) ? units : null
}

// Error de les unitats escrites, o '' si es poden enviar
export function unitsError(text) {
  if (!(text ?? '').trim()) return UNITS_REQUIRED_ERROR
  return parseUnits(text) === null ? UNITS_FORMAT_ERROR : ''
}

// Els imports es calculen en cèntims enters perquè 3 × 10.1 no doni 30.299999…
// PostgREST pot retornar els numeric com a text, per això es passa per Number. També el fa servir la venda
export function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

// Comissió en cèntims: l'1% arrodonit a l'alça (ceil) i, com a màxim, 1 €
export function commissionCents(costCents) {
  return Math.min(Math.ceil((costCents * COMMISSION_RATE_PCT) / 100), MAX_COMMISSION_CENTS)
}

// Revisió del cost d'una compra, en euros. Amb el saldo desconegut (null), remaining i missing són null i
// enough és true: només el backend pot dir si n'hi ha prou
export function buyQuote(units, price, balance = null) {
  const cost = units * toCents(price)
  const commission = commissionCents(cost)
  const total = cost + commission
  const remaining = balance === null ? null : toCents(balance) - total

  return {
    cost: cost / 100,
    commission: commission / 100,
    total: total / 100,
    remaining: remaining === null ? null : remaining / 100,
    enough: remaining === null || remaining >= 0,
    // Import que falta per poder comprar, per a l'avís de saldo insuficient
    missing: remaining === null || remaining >= 0 ? null : -remaining / 100,
  }
}
