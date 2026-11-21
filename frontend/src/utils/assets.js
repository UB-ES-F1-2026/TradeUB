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

// Ruta de la cerca. Amb menys de 2 caràcters el backend retorna tot el catàleg, així que no s'envia el text
export function assetsSearchPath(text) {
  const query = (text ?? '').trim()
  return query.length >= MIN_QUERY_LENGTH ? `/assets?q=${encodeURIComponent(query)}` : '/assets'
}
