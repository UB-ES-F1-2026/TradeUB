import { describe, it, expect } from 'vitest'
import { INVESTOR_QUESTIONS } from '../utils/investorQuestions'
import {
  INVESTOR_PROFILES,
  calculateInvestorProfile,
  calculateScore,
  maxScore,
} from '../utils/investorProfile'

const { BEGINNER, INTERMEDIATE, ADVANCED } = INVESTOR_PROFILES

// Respon cada pregunta amb l'opció de la posició indicada (0, 1 o 2)
const answersWith = (positions) =>
  Object.fromEntries(INVESTOR_QUESTIONS.map((q, i) => [q.id, q.options[positions[i]].id]))

describe('calculateScore', () => {
  it('suma la posició de cada opció triada', () => {
    expect(calculateScore(answersWith([0, 0, 0, 0, 0]))).toBe(0)
    expect(calculateScore(answersWith([2, 1, 0, 1, 2]))).toBe(6)
    expect(calculateScore(answersWith([2, 2, 2, 2, 2]))).toBe(10)
  })

  it('retorna null si falta alguna resposta', () => {
    const answers = answersWith([1, 1, 1, 1, 1])
    delete answers.horitzo
    expect(calculateScore(answers)).toBeNull()
  })

  it('retorna null si una resposta no és cap de les opcions', () => {
    expect(calculateScore({ ...answersWith([1, 1, 1, 1, 1]), caiguda: 'inventada' })).toBeNull()
  })
})

describe('calculateInvestorProfile', () => {
  it('la puntuació màxima del qüestionari és 10', () => {
    expect(maxScore()).toBe(10)
  })

  it.each([
    [[0, 0, 0, 0, 0], 0, BEGINNER],
    [[1, 1, 1, 0, 0], 3, BEGINNER],
    [[1, 1, 1, 1, 0], 4, INTERMEDIATE],
    [[2, 2, 1, 1, 1], 7, INTERMEDIATE],
    [[2, 2, 2, 1, 1], 8, ADVANCED],
    [[2, 2, 2, 2, 2], 10, ADVANCED],
  ])('respostes %j → %i punts → %s', (positions, score, profile) => {
    expect(calculateInvestorProfile(answersWith(positions))).toEqual({ profile, score })
  })

  it('retorna null amb el qüestionari incomplet', () => {
    expect(calculateInvestorProfile({})).toBeNull()
  })
})
