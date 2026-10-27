// Estats possibles d'un pas de l'onboarding
export const STEP_STATUS = {
  PENDING: 'pendent',
  COMPLETED: 'completat',
}

// Percentatge de passos completats (enter de 0 a 100)
export function progressPercent(steps) {
  if (!steps?.length) return 0
  const completed = steps.filter((s) => s.status === STEP_STATUS.COMPLETED).length
  return Math.round((completed / steps.length) * 100)
}

// Primer pas en estat "Pendent" seguint l'ordre de la llista, o null si ja estan tots fets
export function firstPendingStep(steps) {
  return steps?.find((s) => s.status === STEP_STATUS.PENDING) ?? null
}
