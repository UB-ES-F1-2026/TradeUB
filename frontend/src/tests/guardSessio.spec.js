import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// Client real de supabase-js (sense xarxa): la sessió es recupera del localStorage com al navegador
vi.mock('../services/supabase', async () => {
  const { createClient } = await vi.importActual('@supabase/supabase-js')
  return { supabase: createClient('http://localhost:54321', 'anon-key') }
})

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

const user = { id: 'u1', email: 'nom@exemple.com', aud: 'authenticated', role: 'authenticated' }
const base64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '')
const expiresAt = Math.floor(Date.now() / 1000) + 3600
const accessToken = `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ sub: 'u1', exp: expiresAt })}.signatura`

function guardarSessio() {
  localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
    access_token: accessToken,
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user,
  }))
}

// Simula un F5: carrega l'app des de zero amb la URL indicada i retorna la ruta on acaba
async function carregarApp(path) {
  vi.resetModules()
  document.body.innerHTML = '<div id="app"></div>'
  history.replaceState({}, '', path)

  const { default: router } = await import('../router')
  await import('../main.js')
  for (let i = 0; i < 10; i++) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return router.currentRoute.value.fullPath
}

describe('protecció de rutes en carregar la pàgina (F5)', () => {
  beforeEach(() => {
    localStorage.clear()
    // Cap petició real a Supabase
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))
  })

  describe('amb sessió', () => {
    beforeEach(() => guardarSessio())

    it('/login redirigeix a /actius', async () => {
      expect(await carregarApp('/login')).toBe('/actius')
    })

    it('/register redirigeix a /actius', async () => {
      expect(await carregarApp('/register')).toBe('/actius')
    })

    it('es queda a /perfil', async () => {
      expect(await carregarApp('/perfil')).toBe('/perfil')
    })

    it('es queda a /cartera', async () => {
      expect(await carregarApp('/cartera')).toBe('/cartera')
    })
  })

  describe('sense sessió', () => {
    it('/perfil redirigeix a /login guardant la ruta', async () => {
      expect(await carregarApp('/perfil')).toBe('/login?redirect=/perfil')
    })

    it('es queda a /login', async () => {
      expect(await carregarApp('/login')).toBe('/login')
    })
  })
})
