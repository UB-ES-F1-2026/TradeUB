// Import en format moneda català: 1.234,50 €
export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency }).format(amount)
}
