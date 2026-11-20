// PIN de seguretat de les operacions (US1.5): exactament 4 dígits numèrics.
// El backend torna a validar el format; aquí només s'evita enviar peticions que fallaran segur
export const PIN_LENGTH = 4

export const PIN_FORMAT_ERROR = 'El PIN ha de tenir 4 dígits.'
export const PIN_MISMATCH_ERROR = 'Els PIN no coincideixen.'
export const PIN_CURRENT_ERROR = 'El PIN actual és incorrecte.'
export const PIN_SAVE_ERROR = "No s'ha pogut desar el PIN. Torna-ho a provar."
// La targeta creia que no hi havia PIN (per exemple, s'ha configurat des d'una altra pestanya) i el backend ha
// demanat el PIN actual
export const PIN_ALREADY_SET_NOTICE = 'Ja tens un PIN configurat. Escriu el PIN actual per canviar-lo.'

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`)

export function isValidPin(value) {
  return PIN_PATTERN.test(value ?? '')
}

// Errors de cada camp del formulari. Només es comprova el PIN actual quan es canvia un PIN existent
export function validatePinForm({ currentPin, newPin, repeatPin }, { changing }) {
  const errors = {}
  if (changing && !isValidPin(currentPin)) errors.currentPin = PIN_FORMAT_ERROR
  if (!isValidPin(newPin)) errors.newPin = PIN_FORMAT_ERROR
  else if (newPin !== repeatPin) errors.repeatPin = PIN_MISMATCH_ERROR
  return errors
}
