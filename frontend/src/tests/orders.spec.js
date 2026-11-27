import { describe, it, expect } from 'vitest'
import { formatOrderPrice, formatUnits, orderDetailRows, orderSideLabel, orderStatusLabel } from '../utils/orders'

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

  it('les files de la compra acaben amb el total carregat i el saldo resultant', () => {
    const rows = orderDetailRows(BUY)

    expect(rows.map((r) => r.label)).toEqual([
      'Tipus', 'Estat', 'Actiu', 'Unitats', "Preu d'execució", 'Import', 'Comissió', 'Total carregat', 'Data i hora',
      'Saldo resultant',
    ])
    const value = (key) => plain(rows.find((r) => r.key === key).value)
    expect(value('side')).toBe('Compra')
    expect(value('asset')).toBe('Apple Inc. (AAPL)')
    expect(value('units')).toBe('3')
    expect(value('total')).toBe('638,20 €')
    expect(value('balance')).toBe('9.361,80 €')
    expect(value('date')).toMatch(/^26\/11\/2026 · \d{2}:42$/)
  })

  it('a la venda, el total és l\'import net abonat', () => {
    const total = orderDetailRows(SELL).find((r) => r.key === 'total')

    expect(total.label).toBe('Import net abonat')
    expect(plain(total.value)).toBe('636,20 €')
  })

  it('sense saldo resultant mostra un guió', () => {
    const balance = orderDetailRows({ ...BUY, balance_after: null }).find((r) => r.key === 'balance')

    expect(balance.value).toBe('—')
  })
})
