import { formatCurrency } from './currency'

// Cerca d'actius del catàleg simulat (US5.1). Les dades surten de GET /assets
export const MIN_QUERY_LENGTH = 2
export const SEARCH_DELAY_MS = 300

export const ASSETS_LOAD_ERROR = "No s'ha pogut carregar el catàleg d'actius. Torna-ho a provar."
// Text literal del criteri d'acceptació de la US5.1
export const NO_ASSETS_FOUND = "No s'han trobat actius"

// El backend desa el tipus com a 'accio' o 'etf'; el text visible el posa el frontend
const ASSET_TYPE_LABELS = { accio: 'Acció', etf: 'ETF' }

export function assetTypeLabel(type) {
  return ASSET_TYPE_LABELS[type] ?? type
}

// Pestanyes per tipus d'actiu (US5.2). "Tots" és la de per defecte i no filtra
export const ALL_ASSET_TYPES = 'tots'
export const ASSET_TYPE_TABS = [
  { value: ALL_ASSET_TYPES, label: 'Tots' },
  { value: 'accio', label: 'Accions' },
  { value: 'etf', label: 'ETF' },
  { value: 'cripto', label: 'Cripto' },
]

// El filtre per tipus es fa aquí i no al backend: el catàleg és petit, i així es combina amb la cerca (que sí fa el
// backend) sense tornar a demanar res en canviar de pestanya
export function filterAssetsByType(assets, type) {
  return type === ALL_ASSET_TYPES ? assets : assets.filter((asset) => asset.type === type)
}

// Text literal del criteri de la US5.3 quan falta una dada de la cotització
export const QUOTE_UNAVAILABLE = 'No disponible'

const isMissing = (value) => value === null || value === undefined || value === ''

// Últim preu de tancament en euros (US5.3): 212.4 → "212,40 €"
export function formatClosePrice(price) {
  return isMissing(price) ? QUOTE_UNAVAILABLE : formatCurrency(Number(price))
}

// Data de la cotització, que arriba com a "AAAA-MM-DD". Es formata sense passar per Date perquè el fus horari no la
// mogui de dia: "2026-11-13" → "13/11/2026"
export function formatPriceDate(date) {
  if (isMissing(date)) return QUOTE_UNAVAILABLE
  const [year, month, day] = String(date).split('-')
  return `${day}/${month}/${year}`
}

// Variació diària del catàleg (US5.3), que arriba en punts percentuals: 0.85 → "+0,85 %", -1.08 → "−1,08 %", 0 → "0,00 %".
// Intl posa un guionet com a signe negatiu; el criteri demana el signe menys (−)
export function formatDailyChange(pct) {
  if (isMissing(pct)) return QUOTE_UNAVAILABLE
  return new Intl.NumberFormat('ca-ES', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(Number(pct) / 100).replace('-', '−')
}

// Sentit de la variació per triar el color: puja en verd, baixa en vermell i sense canvis (o sense dada) en neutre
export function dailyChangeTrend(pct) {
  if (isMissing(pct)) return 'flat'
  const value = Number(pct)
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

// Ruta de la cerca. Amb menys de 2 caràcters el backend retorna tot el catàleg, així que no s'envia el text
export function assetsSearchPath(text) {
  const query = (text ?? '').trim()
  return query.length >= MIN_QUERY_LENGTH ? `/assets?q=${encodeURIComponent(query)}` : '/assets'
}
