import { describe, it, expect } from 'vitest'
import { REVIEW_SECONDS, isAllowedImage, reviewSecondsLeft } from '../utils/identityDocument'

const fileOf = (name, type) => ({ name, type })

describe('isAllowedImage', () => {
  it.each([
    ['dni.jpg', 'image/jpeg'],
    ['dni.jpeg', 'image/jpeg'],
    ['dni.png', 'image/png'],
    ['DNI.JPG', 'image/jpeg'],
  ])('accepta %s', (name, type) => {
    expect(isAllowedImage(fileOf(name, type))).toBe(true)
  })

  it.each([
    ['dni.pdf', 'application/pdf'],
    ['dni.gif', 'image/gif'],
    ['dni.webp', 'image/webp'],
    ['dni.png', 'application/pdf'],
    ['dni.pdf', 'image/png'],
    ['dni', 'image/png'],
  ])('rebutja %s (%s)', (name, type) => {
    expect(isAllowedImage(fileOf(name, type))).toBe(false)
  })

  it('rebutja l\'absència de fitxer', () => {
    expect(isAllowedImage(null)).toBe(false)
    expect(isAllowedImage(undefined)).toBe(false)
  })
})

describe('reviewSecondsLeft', () => {
  const sentAt = '2026-11-09T10:00:00Z'
  const at = (seconds) => Date.parse(sentAt) + seconds * 1000

  it('just després d\'enviar queden tots els segons', () => {
    expect(reviewSecondsLeft(sentAt, at(0))).toBe(REVIEW_SECONDS)
  })

  it('arrodoneix cap amunt els segons que falten', () => {
    expect(reviewSecondsLeft(sentAt, at(4.2))).toBe(11)
  })

  it('un cop passat el temps retorna 0', () => {
    expect(reviewSecondsLeft(sentAt, at(15))).toBe(0)
    expect(reviewSecondsLeft(sentAt, at(60))).toBe(0)
  })

  it('si el rellotge del navegador va endarrerit no supera el màxim', () => {
    expect(reviewSecondsLeft(sentAt, at(-30))).toBe(REVIEW_SECONDS)
  })

  it('sense un moment d\'enviament vàlid compta el temps sencer', () => {
    expect(reviewSecondsLeft(null)).toBe(REVIEW_SECONDS)
    expect(reviewSecondsLeft('no és una data')).toBe(REVIEW_SECONDS)
  })
})
