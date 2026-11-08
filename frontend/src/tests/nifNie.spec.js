import { describe, it, expect } from 'vitest'
import { isValidNifNie, NIF_NIE_ERROR } from '../utils/nifNie'

describe('isValidNifNie', () => {
  it('accepta un NIF amb la lletra de control correcta', () => {
    expect(isValidNifNie('12345678Z')).toBe(true)
  })
  it('accepta un NIE de cada prefix amb la lletra correcta', () => {
    expect(isValidNifNie('X0000000T')).toBe(true)
    expect(isValidNifNie('Y1234567X')).toBe(true)
  })
  it('accepta el document en minúscules i amb espais als extrems', () => {
    expect(isValidNifNie('  12345678z ')).toBe(true)
  })
  it('rebutja un NIF amb la lletra de control incorrecta', () => {
    expect(isValidNifNie('12345678A')).toBe(false)
  })
  it('rebutja un NIE amb la lletra de control incorrecta', () => {
    expect(isValidNifNie('X0000000A')).toBe(false)
  })
  it('rebutja formats incorrectes', () => {
    expect(isValidNifNie('1234567Z')).toBe(false)
    expect(isValidNifNie('123456789Z')).toBe(false)
    expect(isValidNifNie('W1234567L')).toBe(false)
    expect(isValidNifNie('X00000000T')).toBe(false)
    expect(isValidNifNie('ABC')).toBe(false)
  })
  it('rebutja el camp buit', () => {
    expect(isValidNifNie('')).toBe(false)
  })
  it('exposa el missatge d\'error en català', () => {
    expect(NIF_NIE_ERROR).toBe('El format del NIF/NIE no és vàlid.')
  })
})
