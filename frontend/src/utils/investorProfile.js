import { INVESTOR_QUESTIONS } from './investorQuestions'

// Perfils d'inversor possibles, de menys a més experiència
export const INVESTOR_PROFILES = {
  BEGINNER: 'principiant',
  INTERMEDIATE: 'intermedi',
  ADVANCED: 'avancat',
}

export const PROFILE_LABELS = {
  [INVESTOR_PROFILES.BEGINNER]: 'Principiant',
  [INVESTOR_PROFILES.INTERMEDIATE]: 'Intermedi',
  [INVESTOR_PROFILES.ADVANCED]: 'Avançat',
}

// Cada opció val la seva posició dins la pregunta (0, 1, 2): les opcions van de menys a més experiència.
// Amb 5 preguntes de 3 opcions la puntuació va de 0 a 10
export function calculateScore(answers, questions = INVESTOR_QUESTIONS) {
  let score = 0
  for (const question of questions) {
    const points = question.options.findIndex((o) => o.id === answers?.[question.id])
    // Una pregunta sense resposta (o amb una opció que no existeix) no permet calcular el perfil
    if (points === -1) return null
    score += points
  }
  return score
}

// Trams sobre la puntuació màxima: fins al 30 % principiant, fins al 70 % intermedi, la resta avançat
export function profileForScore(score, maxScore) {
  const ratio = score / maxScore
  if (ratio <= 0.3) return INVESTOR_PROFILES.BEGINNER
  if (ratio <= 0.7) return INVESTOR_PROFILES.INTERMEDIATE
  return INVESTOR_PROFILES.ADVANCED
}

export function maxScore(questions = INVESTOR_QUESTIONS) {
  return questions.reduce((total, q) => total + q.options.length - 1, 0)
}

// Avalua les respostes i retorna { profile, score }, o null si falta alguna resposta
export function calculateInvestorProfile(answers, questions = INVESTOR_QUESTIONS) {
  const score = calculateScore(answers, questions)
  if (score === null) return null
  return { profile: profileForScore(score, maxScore(questions)), score }
}
