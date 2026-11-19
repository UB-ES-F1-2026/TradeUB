import { describe, it, expect } from 'vitest'
import { isValidPin, validatePinForm, PIN_FORMAT_ERROR, PIN_MISMATCH_ERROR } from '../utils/pin'

describe('isValidPin', () => {
  it('accepta exactament 4 dígits', () => {
    expect(isValidPin('0123')).toBe(true)
  })

  it.each(['', '123', '12345', '12a4', ' 1234', '12 34', null, undefined])('rebutja %p', (value) => {
    expect(isValidPin(value)).toBe(false)
  })
})

describe('validatePinForm', () => {
  it('sense errors quan el PIN nou és vàlid i es repeteix igual', () => {
    expect(validatePinForm({ newPin: '1234', repeatPin: '1234' }, { changing: false })).toEqual({})
  })

  it('demana 4 dígits al PIN nou', () => {
    expect(validatePinForm({ newPin: '12', repeatPin: '12' }, { changing: false })).toEqual({ newPin: PIN_FORMAT_ERROR })
  })

  it('avisa si els dos PIN no coincideixen', () => {
    expect(validatePinForm({ newPin: '1234', repeatPin: '4321' }, { changing: false })).toEqual({
      repeatPin: PIN_MISMATCH_ERROR,
    })
  })

  it('en canviar-lo, també demana el PIN actual amb 4 dígits', () => {
    expect(validatePinForm({ currentPin: '', newPin: '1234', repeatPin: '1234' }, { changing: true })).toEqual({
      currentPin: PIN_FORMAT_ERROR,
    })
  })

  it('en crear-lo, no comprova el PIN actual', () => {
    expect(validatePinForm({ currentPin: '', newPin: '1234', repeatPin: '1234' }, { changing: false })).toEqual({})
  })
})
