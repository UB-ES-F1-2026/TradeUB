import { describe, it, expect } from 'vitest'
import { formatOrderPrice, formatUnits, orderDetail, orderSideLabel, orderStatusLabel } from '../utils/orders'

const rowsOf = (order) => [...orderDetail(order).operation, ...orderDetail(order).amounts]

// Intl separa la xifra i el símbol (€) amb un espai no separable: es normalitza per comparar
const plain = (text) => text.replace(/\s/g, ' ')

const BUY = {
  id: '6f1c2b8e-0000-4000-8000-000000000001',
  side: 'compra',
  status: 'executada',
  asset: { id: 7, name: 'Apple Inc.', ticker: 'AAPL' },
  units: '3.00000000',
  price: '212.400000',
  amount: '637.20',
  commission: '1.00',
  total: '638.20',
  created_at: '2026-11-26T09:42:00+00:00',
  executed_at: '2026-11-26T09:42:00+00:00',
  balance_after: '9361.80',
}

const SELL = { ...BUY, side: 'venda', total: '636.20', balance_after: '9998.00' }

describe('utils/orders', () => {
  it('tradueix el tipus i l\'estat', () => {
    expect(orderSideLabel('compra')).toBe('Compra')
    expect(orderSideLabel('venda')).toBe('Venda')
    expect(orderStatusLabel('executada')).toBe('Executada')
  })

  it('mostra les unitats sense els zeros de numeric', () => {
    expect(formatUnits('3.00000000')).toBe('3')
    expect(formatUnits('1200')).toBe('1.200')
  })

  it('mostra el preu amb dos decimals com a mínim i els que calguin fins a sis', () => {
    expect(plain(formatOrderPrice('212.400000'))).toBe('212,40 €')
    expect(plain(formatOrderPrice('0.081234'))).toBe('0,081234 €')
  })

  it('la compra mostra el rebut amb l\'import carregat, la caixa Operació i la caixa Imports', () => {
    const detail = orderDetail(BUY)

    expect(plain(detail.headline)).toBe('−638,20 €')
    expect(detail.concept).toBe('Compra de 3 AAPL')
    expect(detail.status).toBe('Executada')
    expect(detail.operation.map((r) => r.label)).toEqual(['Tipus', 'Actiu', 'Unitats', "Preu d'execució", 'Data i hora'])
    // C2: "Import (unitats × preu)"
    expect(detail.amounts.map((r) => plain(r.label))).toEqual([
      'Import (3 × 212,40 €)', 'Comissió', 'Total carregat', 'Saldo resultant',
    ])
    const rows = rowsOf(BUY)
    const value = (key) => plain(rows.find((r) => r.key === key).value)
    expect(value('side')).toBe('Compra')
    expect(value('asset')).toBe('Apple Inc. · AAPL')
    expect(value('units')).toBe('3')
    expect(value('total')).toBe('638,20 €')
    expect(value('balance')).toBe('9.361,80 €')
    expect(value('date')).toMatch(/^26\/11\/2026 · \d{2}:42$/)
  })

  it('a la venda, l\'import entra al saldo, la comissió resta i el total és l\'import net abonat', () => {
    const detail = orderDetail(SELL)
    const total = rowsOf(SELL).find((r) => r.key === 'total')

    expect(plain(detail.headline)).toBe('+636,20 €')
    expect(detail.concept).toBe('Venda de 3 AAPL')
    expect(plain(rowsOf(SELL).find((r) => r.key === 'commission').value)).toBe('−1,00 €')
    expect(total.label).toBe('Import net abonat')
    expect(plain(total.value)).toBe('636,20 €')
  })

  it('sense saldo resultant mostra un guió', () => {
    const balance = rowsOf({ ...BUY, balance_after: null }).find((r) => r.key === 'balance')

    expect(balance.value).toBe('—')
  })
})
