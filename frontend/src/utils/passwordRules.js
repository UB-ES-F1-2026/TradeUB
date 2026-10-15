export function getPasswordRules(password) {
  return [
    { label: 'Mínim 8 caràcters', ok: password.length >= 8 },
    { label: 'Almenys un número', ok: /\d/.test(password) },
  ]
}

export function isPasswordValid(password) {
  return getPasswordRules(password).every((r) => r.ok)
}