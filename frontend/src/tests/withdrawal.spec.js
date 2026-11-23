import { describe, it, expect } from 'vitest'
import { formatCurrency } from '../utils/currency'
import {
  WITHDRAWAL_FORMAT_ERROR,
  WITHDRAWAL_MIN_ERROR,
  WITHDRAWAL_REQUIRED_ERROR,
  isValidIban,
  normalizeIban,
  withdrawalError,
} from '../utils/withdrawal'

// IBAN de prova amb el dígit de control correcte
const TEST_IBAN = 'ES9121000418450200051332'

describe('withdrawalError', () => {
  it("accepta imports vàlids dins del saldo", () => {
    expect(withdrawalError('1', 100)).toBe('')
    expect(withdrawalError('50,25', 100)).toBe('')
    expect(withdrawalError('100', 100)).toBe('')
  })

  it("demana l'import i el format en euros", () => {
    expect(withdrawalError('  ', 100)).toBe(WITHDRAWAL_REQUIRED_ERROR)
    expect(withdrawalError('10,123', 100)).toBe(WITHDRAWAL_FORMAT_ERROR)
    expect(withdrawalError('-5', 100)).toBe(WITHDRAWAL_FORMAT_ERROR)
  })

  it("rebutja menys d'1 € amb el text del criteri", () => {
    expect(withdrawalError('0,99', 100)).toBe("L'import mínim de retirada és d'1 €.")
    expect(WITHDRAWAL_MIN_ERROR).toBe("L'import mínim de retirada és d'1 €.")
  })

  it('amb saldo insuficient diu quant falta, sense errors de decimals', () => {
    expect(withdrawalError('10,10', 10)).toBe(`Saldo insuficient. Et falten ${formatCurrency(0.1)} per completar l'operació`)
    expect(withdrawalError('1500', 250.5)).toBe(`Saldo insuficient. Et falten ${formatCurrency(1249.5)} per completar l'operació`)
  })

  it('sense saldo conegut no comprova el saldo', () => {
    expect(withdrawalError('1000000')).toBe('')
  })
})

describe('IBAN', () => {
  it('accepta un IBAN espanyol vàlid amb o sense espais i en minúscules', () => {
    expect(isValidIban(TEST_IBAN)).toBe(true)
    expect(isValidIban('ES91 2100 0418 4502 0005 1332')).toBe(true)
    expect(isValidIban('es91 2100 0418 4502 0005 1332')).toBe(true)
  })

  it('rebutja un dígit de control incorrecte, una longitud dolenta o un altre país', () => {
    expect(isValidIban('ES9121000418450200051333')).toBe(false)
    expect(isValidIban('ES912100041845020005133')).toBe(false)
    expect(isValidIban('DE89370400440532013000')).toBe(false)
    expect(isValidIban('')).toBe(false)
  })

  it("normalitza l'IBAN abans d'enviar-lo", () => {
    expect(normalizeIban(' es91 2100 0418 4502 0005 1332 ')).toBe(TEST_IBAN)
  })
})
