import { describe, it, expect } from 'vitest'
import { STEP_STATUS, firstPendingStep, progressPercent } from '../utils/onboarding'

const { PENDING, COMPLETED } = STEP_STATUS

describe('progressPercent', () => {
  it('és 0 sense passos', () => {
    expect(progressPercent([])).toBe(0)
    expect(progressPercent(undefined)).toBe(0)
  })

  it('calcula el percentatge de passos completats arrodonit', () => {
    expect(progressPercent([{ status: COMPLETED }, { status: PENDING }, { status: PENDING }])).toBe(33)
    expect(progressPercent([{ status: COMPLETED }, { status: COMPLETED }, { status: PENDING }])).toBe(67)
  })

  it('és 100 quan tots els passos estan completats', () => {
    expect(progressPercent([{ status: COMPLETED }, { status: COMPLETED }])).toBe(100)
  })
})

describe('firstPendingStep', () => {
  it("retorna el primer pas pendent segons l'ordre", () => {
    const steps = [
      { id: 'a', status: COMPLETED },
      { id: 'b', status: PENDING },
      { id: 'c', status: PENDING },
    ]
    expect(firstPendingStep(steps).id).toBe('b')
  })

  it('no salta un pas pendent anterior encara que els següents estiguin fets', () => {
    const steps = [
      { id: 'a', status: PENDING },
      { id: 'b', status: COMPLETED },
    ]
    expect(firstPendingStep(steps).id).toBe('a')
  })

  it('retorna null si no queda cap pas pendent', () => {
    expect(firstPendingStep([{ id: 'a', status: COMPLETED }])).toBeNull()
  })
})
