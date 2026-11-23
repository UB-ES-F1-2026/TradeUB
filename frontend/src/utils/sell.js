import { UNITS_FORMAT_ERROR, commissionCents, parseUnits, toCents } from './buy'

// Venda d'unitats d'una posició (US6.2). El càlcul és el mateix que fa sell_asset al backend (#128): aquí només
// serveix per mostrar l'import net abans de confirmar. El que s'ingressa de veritat ho decideix el backend amb el
// preu del catàleg. La comissió és la de la compra, però es descompta de l'import

export const SELL_UNITS_REQUIRED_ERROR = 'Introdueix les unitats que vols vendre.'
// Textos que retorna POST /orders/sell (api/orders.py)
export const SELL_INSUFFICIENT_UNITS_ERROR = "No tens prou unitats d'aquest actiu per vendre."
export const SELL_FAILED_ERROR = "No s'ha pogut processar la venda. El teu saldo no ha canviat."

// Error de les unitats escrites, o '' si es poden enviar. Com a màxim, les unitats de la posició (held)
export function sellUnitsError(text, held) {
  if (!(text ?? '').trim()) return SELL_UNITS_REQUIRED_ERROR
  const units = parseUnits(text)
  if (units === null) return UNITS_FORMAT_ERROR
  return units > held ? SELL_INSUFFICIENT_UNITS_ERROR : ''
}

// Revisió de l'import d'una venda, en euros: import brut, comissió i import net que s'ingressa al saldo
export function sellQuote(units, price) {
  const amount = units * toCents(price)
  const commission = commissionCents(amount)
  return {
    amount: amount / 100,
    commission: commission / 100,
    net: (amount - commission) / 100,
  }
}
