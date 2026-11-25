import { describe, expect, it } from 'vitest'
import { marketNotes } from '../utils/marketNotes'

const asset = (id, name, ticker, pct) => ({ id, name, ticker, daily_change_pct: pct })

const texts = (assets) => marketNotes(assets).map((n) => n.text)

// Intl posa un espai no separable abans del %; els tests el comparen com un espai normal
const normalize = (list) => list.map((text) => text.replace(/\s/g, ' '))

describe('marketNotes', () => {
  // C2: un avís per a cada actiu que puja o baixa un 2 % o més
  it('fa un avís per a cada actiu que es mou un 2 % o més, i cap per als que es mouen menys', () => {
    const notes = normalize(
      texts([
        asset(1, 'Pujada gran', 'UP', '9.00'),
        asset(2, 'Baixada gran', 'DOWN', '-9.00'),
        asset(3, 'NVIDIA', 'NVDA', '2.83'),
        asset(4, 'ASML Holding', 'ASML', '-2.00'),
        asset(5, 'Apple', 'AAPL', '1.99'),
      ]),
    )

    expect(notes).toContain('NVIDIA puja un 2,83 %')
    expect(notes).toContain('ASML Holding baixa un 2,00 %')
    expect(notes.some((text) => text.startsWith('Apple'))).toBe(false)
  })

  // C2: un avís per al valor que més puja i un per al que més baixa, amb el signe de US5.3
  it('fa un avís per al valor que més puja i un per al que més baixa, primer de tot', () => {
    const notes = normalize(
      texts([
        asset(1, 'Apple', 'AAPL', '0.85'),
        asset(2, 'Banco Santander', 'SAN', '1.79'),
        asset(3, 'Microsoft', 'MSFT', '-0.42'),
      ]),
    )

    expect(notes).toEqual([
      'Banco Santander és el valor que més puja: +1,79 %',
      'Microsoft és el valor que més baixa: −0,42 %',
    ])
  })

  // C2: sense repetir cap actiu
  it('no repeteix un actiu que és el que més es mou i també passa del 2 %', () => {
    const notes = marketNotes([
      asset(1, 'NVIDIA', 'NVDA', '2.47'),
      asset(2, 'Tesla', 'TSLA', '-3.12'),
      asset(3, 'Apple', 'AAPL', '0.85'),
    ])

    expect(notes.map((n) => n.ticker)).toEqual(['NVDA', 'TSLA'])
    expect(normalize(notes.map((n) => n.text))).toEqual([
      'NVIDIA és el valor que més puja: +2,47 %',
      'Tesla és el valor que més baixa: −3,12 %',
    ])
  })

  // C2: el ticker i el color de US5.3 (sentit de la variació)
  it('cada avís porta el ticker i el sentit de la variació', () => {
    const [up, down] = marketNotes([asset(1, 'NVIDIA', 'NVDA', '2.47'), asset(2, 'Tesla', 'TSLA', '-3.12')])

    expect(up).toMatchObject({ ticker: 'NVDA', trend: 'up' })
    expect(down).toMatchObject({ ticker: 'TSLA', trend: 'down' })
  })

  // C2: si cap actiu no es mou, no hi ha avisos (la secció diu "No hi ha moviments destacats")
  it('sense variacions no fa cap avís', () => {
    expect(marketNotes([asset(1, 'Telefónica', 'TEF', '0.00'), asset(2, 'Sense dada', 'X', null)])).toEqual([])
    expect(marketNotes(null)).toEqual([])
  })
})
