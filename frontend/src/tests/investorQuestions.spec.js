import { describe, it, expect } from 'vitest'
import { INVESTOR_QUESTIONS } from '../utils/investorQuestions'

describe("preguntes del qüestionari d'experiència inversora", () => {
  it('són 5 preguntes amb identificadors únics', () => {
    const ids = INVESTOR_QUESTIONS.map((q) => q.id)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
  })

  it('cada pregunta és de resposta tancada amb opcions úniques', () => {
    for (const question of INVESTOR_QUESTIONS) {
      const optionIds = question.options.map((o) => o.id)
      expect(optionIds.length).toBeGreaterThanOrEqual(2)
      expect(new Set(optionIds).size).toBe(optionIds.length)
      expect(question.options.every((o) => o.label)).toBe(true)
    }
  })
})
