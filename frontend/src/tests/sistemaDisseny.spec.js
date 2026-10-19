import { describe, it, expect } from 'vitest'

// Comprova que la resta de l'app passa pel sistema de disseny (skill tradeub-ui):
// controls via components Ui*, logotip via UiLogo i colors només amb tokens --tub-*.
// components/ui és el propi sistema de disseny, per això queda fora.
const fitxers = import.meta.glob(
  ['../**/*.vue', '!../components/ui/**'],
  { query: '?raw', import: 'default', eager: true }
)

// Excepcions justificades: [fitxer, regla, motiu]
const excepcions = [
  ['../views/StyleguideView.vue', 'colors', 'mostra del sistema de disseny (gràfic SVG i vora de les mostres de color)'],
  ['../components/AppNavBar.vue', 'controls', 'botó d\'icona del menú mòbil; UiButton encara no té variant d\'icona'],
]

const regles = {
  controls: {
    patro: /<(button|input|select|textarea)\b/g,
    missatge: 'usa UiButton / UiInput en lloc de l\'element HTML',
  },
  logotip: {
    patro: /<img\b[^>]*\/brand\//g,
    missatge: 'el logotip va sempre amb UiLogo',
  },
  colors: {
    patro: /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/gi,
    missatge: 'colors només amb var(--tub-*); si falta, afegeix el token a styles/tokens.css',
  },
}

const senseComentaris = (codi) => codi
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const exempt = (fitxer, regla) => excepcions.some(([f, r]) => f === fitxer && r === regla)

describe('sistema de disseny', () => {
  it('troba els components de l\'app', () => {
    expect(Object.keys(fitxers).length).toBeGreaterThan(0)
  })

  for (const [nom, regla] of Object.entries(regles)) {
    it(`${nom}: ${regla.missatge}`, () => {
      const infraccions = Object.entries(fitxers)
        .filter(([fitxer]) => !exempt(fitxer, nom))
        .flatMap(([fitxer, codi]) =>
          [...senseComentaris(codi).matchAll(regla.patro)].map((m) => `${fitxer}: ${m[0]}`)
        )

      expect(infraccions).toEqual([])
    })
  }
})
