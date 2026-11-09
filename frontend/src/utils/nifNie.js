// Lletra de control del NIF/NIE: el resultat de (número % 23) indexa aquesta cadena
const CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

// El NIE substitueix la lletra inicial per un dígit abans de calcular la lletra de control
const NIE_PREFIX_DIGIT = { X: '0', Y: '1', Z: '2' }

export const NIF_NIE_ERROR = 'El format del NIF/NIE no és vàlid.'

// Valida un NIF (8 xifres + lletra) o un NIE (X/Y/Z + 7 xifres + lletra) espanyol
export function isValidNifNie(value) {
  const normalized = value.trim().toUpperCase()

  const nif = /^(\d{8})([A-Z])$/.exec(normalized)
  if (nif) {
    return CONTROL_LETTERS[Number(nif[1]) % 23] === nif[2]
  }

  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(normalized)
  if (nie) {
    const number = Number(NIE_PREFIX_DIGIT[nie[1]] + nie[2])
    return CONTROL_LETTERS[number % 23] === nie[3]
  }

  return false
}
