// Verificació simulada del DNI (US2.4). La imatge només es comprova al navegador: no s'envia ni es desa enlloc

export const DOCUMENT_FORMAT_ERROR = "Només s'accepten imatges JPG o PNG."

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png']
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

// Valor de l'atribut accept de l'input: el selector de fitxers del sistema ja filtra aquests formats
export const ACCEPTED_FILES = [...ALLOWED_EXTENSIONS, ...ALLOWED_TYPES].join(',')

// Estats de la verificació tal com els retorna el backend a GET /users/me (camp verificacio.estat)
export const VERIFICATION_STATUS = {
  PENDING: 'pendent',
  IN_REVIEW: 'en-revisio',
  VERIFIED: 'verificat',
}

// Segons que el backend manté la verificació "en revisió" abans de donar-la per verificada
export const REVIEW_SECONDS = 15

// Un fitxer és vàlid si l'extensió i el tipus MIME són de JPG o PNG (l'accept de l'input es pot saltar)
export function isAllowedImage(file) {
  if (!file?.name) return false
  const name = file.name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext)) && ALLOWED_TYPES.includes(file.type)
}

// Segons que falten perquè acabi la revisió, de 0 a REVIEW_SECONDS, a partir del moment de l'enviament.
// Si el rellotge del navegador no coincideix amb el del servidor, el valor queda limitat a aquest interval
export function reviewSecondsLeft(sentAt, now = Date.now()) {
  const sentTime = Date.parse(sentAt)
  if (!sentAt || Number.isNaN(sentTime)) return REVIEW_SECONDS
  const left = Math.ceil(REVIEW_SECONDS - (now - sentTime) / 1000)
  return Math.min(REVIEW_SECONDS, Math.max(0, left))
}
