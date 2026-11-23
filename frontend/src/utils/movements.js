import { formatCurrency } from './currency'

// Tipus de moviment d'efectiu tal com els retorna GET /account/movements (US3.5)
export const MOVEMENT_TYPE_LABELS = {
  ingres: 'Ingrés',
  retirada: 'Retirada',
}

// Valor del filtre "Tots": no s'envia cap tipus al backend
export const ALL_MOVEMENT_TYPES = 'tots'

export const MOVEMENT_TYPE_OPTIONS = [
  { value: ALL_MOVEMENT_TYPES, label: 'Tots' },
  { value: 'ingres', label: MOVEMENT_TYPE_LABELS.ingres },
  { value: 'retirada', label: MOVEMENT_TYPE_LABELS.retirada },
]

export const movementTypeLabel = (type) => MOVEMENT_TYPE_LABELS[type] ?? type

// L'import arriba amb signe (negatiu a les retirades). PostgREST pot retornar els numeric com a text
export const isIncoming = (amount) => Number(amount) >= 0

// "+250,00 €" o "−100,00 €", amb el signe menys tipogràfic
export function formatSignedAmount(amount) {
  const value = Number(amount)
  return `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`
}

// 13/11/2026, a l'hora local de l'usuari
export const formatMovementDate = (iso) =>
  new Date(iso).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

// 10:42, a l'hora local de l'usuari
export const formatMovementTime = (iso) =>
  new Date(iso).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
