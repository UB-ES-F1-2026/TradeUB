import { formatCurrency } from './currency'
import { formatMovementDate, formatMovementTime } from './movements'

// Detall d'una compra o venda (US6.5), tal com el retorna GET /orders/{id}. Tot surt de l'ordre desada en executar-la:
// no es recalcula res amb el preu actual de l'actiu

export const ORDER_LOAD_ERROR = "No s'ha pogut carregar el detall de l'operació. Torna-ho a provar."

const SIDE_LABELS = { compra: 'Compra', venda: 'Venda' }
// En aquesta US totes les ordres són executades; US6.6 i US6.7 hi afegeixen "pendent" i "cancel·lada"
const STATUS_LABELS = { executada: 'Executada' }

export const orderSideLabel = (side) => SIDE_LABELS[side] ?? side
export const orderStatusLabel = (status) => STATUS_LABELS[status] ?? status

// Les unitats arriben com a numeric(20, 8): "3.00000000" → "3". Només s'admeten enteres, però es mostren igualment
// els decimals que hi hagi
export function formatUnits(units) {
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 8 }).format(Number(units))
}

// Preu d'execució: arriba amb fins a 6 decimals (numeric(18, 6)). Amb dos decimals, una cripto barata com DOGE (0,0812 €)
// es veuria com 0,08 €; per això se'n mostren els que calguin, amb dos com a mínim
export function formatOrderPrice(price) {
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number(price))
}

// Data i hora de l'execució, a l'hora local de l'usuari: "13/11/2026 · 10:42"
export function formatOrderDateTime(order) {
  const at = order.executed_at ?? order.created_at
  return `${formatMovementDate(at)} · ${formatMovementTime(at)}`
}

// Files del detall en l'ordre en què es mostren. `total` és el que s'ha carregat al saldo en una compra (import +
// comissió) i el que s'hi ha abonat en una venda (import − comissió)
export function orderDetailRows(order) {
  const money = (value) => formatCurrency(Number(value))
  return [
    { key: 'side', label: 'Tipus', value: orderSideLabel(order.side) },
    { key: 'status', label: 'Estat', value: orderStatusLabel(order.status) },
    { key: 'asset', label: 'Actiu', value: `${order.asset.name} (${order.asset.ticker})` },
    { key: 'units', label: 'Unitats', value: formatUnits(order.units), numeric: true },
    { key: 'price', label: "Preu d'execució", value: formatOrderPrice(order.price), numeric: true },
    { key: 'amount', label: 'Import', value: money(order.amount), numeric: true },
    { key: 'commission', label: 'Comissió', value: money(order.commission), numeric: true },
    {
      key: 'total',
      label: order.side === 'venda' ? 'Import net abonat' : 'Total carregat',
      value: money(order.total),
      numeric: true,
    },
    { key: 'date', label: 'Data i hora', value: formatOrderDateTime(order), numeric: true },
    {
      key: 'balance',
      label: 'Saldo resultant',
      value: order.balance_after === null || order.balance_after === undefined ? '—' : money(order.balance_after),
      numeric: true,
    },
  ]
}
