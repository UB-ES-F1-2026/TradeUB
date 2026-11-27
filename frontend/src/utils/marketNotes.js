import { dailyChangeTrend, formatDailyChange } from './assets'

// Avisos de preu de l'actualitat del mercat (US17.1). Surten de la mateixa llista d'actius que mostra Actius, així
// que no cal backend: tothom veu els mateixos avisos perquè surten de les mateixes dades

// Variació a partir de la qual un actiu té avís propi, en punts percentuals
export const NOTE_THRESHOLD_PCT = 2

// Text literal del criteri C2 quan no hi ha cap avís
export const NO_NOTES = 'No hi ha moviments destacats'

// Percentatge sense signe, per als textos amb verb: 2.83 → "2,83 %". El verb ja diu si puja o baixa
function formatPercent(pct) {
  return new Intl.NumberFormat('ca-ES', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(pct) / 100)
}

function note(asset, pct, text) {
  return { id: asset.id, ticker: asset.ticker, name: asset.name, text, trend: dailyChangeTrend(pct) }
}

// Avisos per a la llista d'actius, en aquest ordre:
// 1. el valor que més puja ("Banco Santander és el valor que més puja: +2,95 %"), si n'hi ha cap que pugi;
// 2. el que més baixa ("Tesla és el valor que més baixa: −3,67 %"), si n'hi ha cap que baixi;
// 3. cada actiu que es mou un 2 % o més ("NVIDIA puja un 2,83 %"), de més a menys moviment.
// Un actiu no surt mai dues vegades: si el que més puja també passa del 2 %, només queda l'avís de "més puja".
// Els actius sense variació no compten
export function marketNotes(assets) {
  const moves = (assets ?? [])
    .map((asset) => ({ asset, pct: Number(asset.daily_change_pct) }))
    .filter(({ asset, pct }) => asset.daily_change_pct !== null && asset.daily_change_pct !== undefined && Number.isFinite(pct))
    .sort((a, b) => b.pct - a.pct)

  const notes = []
  const top = moves[0]
  const bottom = moves[moves.length - 1]

  if (top && top.pct > 0) {
    notes.push(note(top.asset, top.pct, `${top.asset.name} és el valor que més puja: ${formatDailyChange(top.pct)}`))
  }
  if (bottom && bottom.pct < 0) {
    notes.push(
      note(bottom.asset, bottom.pct, `${bottom.asset.name} és el valor que més baixa: ${formatDailyChange(bottom.pct)}`),
    )
  }

  const shown = new Set(notes.map((n) => n.id))
  moves
    .filter(({ asset, pct }) => !shown.has(asset.id) && Math.abs(pct) >= NOTE_THRESHOLD_PCT)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .forEach(({ asset, pct }) => {
      const verb = pct > 0 ? 'puja' : 'baixa'
      notes.push(note(asset, pct, `${asset.name} ${verb} un ${formatPercent(pct)}`))
    })

  return notes
}
