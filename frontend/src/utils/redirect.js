// Destinació després d'autenticar-se (?redirect=...). Només s'accepten rutes internes
// per evitar redireccions a webs externes (//exemple.com, /\exemple.com)
export function safeRedirect(redirect, fallback = '/actius') {
  if (typeof redirect === 'string' && /^\/(?![/\\])/.test(redirect)) return redirect
  return fallback
}
