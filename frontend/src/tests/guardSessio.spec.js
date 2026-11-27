import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { START_LOCATION } from 'vue-router'

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
const verifiedFactor = { id: 'f1', factor_type: 'totp', status: 'verified' }

// aal: nivell de la sessió; factors: amb un factor verificat, l'usuari té la 2FA activa
function guardarSessio({ aal = 'aal1', factors = [] } = {}) {
  const accessToken = `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ sub: 'u1', exp: expiresAt, aal })}.signatura`
  localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
    access_token: accessToken,
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: { ...user, factors },
  }))
}

// Simula un F5: carrega l'app des de zero amb la URL indicada i retorna la ruta on acaba
async function carregarApp(path) {
  vi.resetModules()
  document.body.innerHTML = '<div id="app"></div>'
  history.replaceState({}, '', path)

  const { default: router } = await import('../router')
  await import('../main.js')
  // main.js instal·la el router quan acaba initAuth(), que és asíncron. S'espera la primera navegació (amb les
  // redireccions del guard) i no un temps fix: amb la màquina carregada, 100 ms no sempre n'hi havia prou i la ruta
  // encara era '/'
  await vi.waitFor(() => {
    if (router.currentRoute.value === START_LOCATION) throw new Error('El router encara no ha navegat')
  }, { timeout: 5000, interval: 10 })
  await router.isReady()
  await flushPromises()
  return router.currentRoute.value.fullPath
}

// La barra (AppNavBar) i la pàgina 404 són components: s'espera que es pintin
const barra = () => document.querySelector('.navbar')
async function esperaText(text) {
  await vi.waitFor(() => {
    if (!document.body.textContent.includes(text)) throw new Error('Encara no surt: ' + text)
  }, { timeout: 5000, interval: 10 })
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

    for (const path of ['/cartera', '/bustia']) {
      it(`${path} redirigeix a /actius`, async () => {
        expect(await carregarApp(path)).toBe('/actius')
      })
    }

    it('es queda a /historial', async () => {
      expect(await carregarApp('/historial')).toBe('/historial')
    })

    it('es queda a /compte-efectiu', async () => {
      expect(await carregarApp('/compte-efectiu')).toBe('/compte-efectiu')
    })

    it('sense 2FA, es queda a /reset-password', async () => {
      expect(await carregarApp('/reset-password')).toBe('/reset-password')
    })

    // Technical Debt 4
    it('una ruta que no existeix mostra la pàgina 404 amb la barra', async () => {
      expect(await carregarApp('/no-existeix')).toBe('/no-existeix')
      await esperaText('Pàgina no trobada')
      expect(barra()).not.toBeNull()
    })
  })

  describe('sense sessió', () => {
    it('/perfil redirigeix a /login guardant la ruta', async () => {
      expect(await carregarApp('/perfil')).toBe('/login?redirect=/perfil')
    })

    it('es queda a /login', async () => {
      expect(await carregarApp('/login')).toBe('/login')
    })

    it('/mfa redirigeix a /login', async () => {
      expect(await carregarApp('/mfa')).toBe('/login')
    })

    // Technical Debt 4
    it('una ruta que no existeix mostra la pàgina 404 sense la barra', async () => {
      expect(await carregarApp('/no-existeix/de-cap-manera')).toBe('/no-existeix/de-cap-manera')
      await esperaText('Pàgina no trobada')
      expect(barra()).toBeNull()
    })

    it('/ui no mostra la barra', async () => {
      expect(await carregarApp('/ui')).toBe('/ui')
      await esperaText('Tipografia')
      expect(barra()).toBeNull()
    })
  })

  describe('amb la 2FA activa i el codi pendent (aal1)', () => {
    beforeEach(() => guardarSessio({ aal: 'aal1', factors: [verifiedFactor] }))

    it('una ruta privada porta a /mfa guardant la ruta', async () => {
      expect(await carregarApp('/perfil')).toBe('/mfa?redirect=/perfil')
    })

    it('/login porta a /mfa', async () => {
      expect(await carregarApp('/login')).toBe('/mfa')
    })

    it('es queda a /mfa', async () => {
      expect(await carregarApp('/mfa')).toBe('/mfa')
    })

    it('/reset-password demana el codi abans de canviar la contrasenya', async () => {
      expect(await carregarApp('/reset-password')).toBe('/mfa?redirect=/reset-password')
    })

    // Technical Debt 4: amb el codi pendent no hi ha barra, tampoc a la 404
    it('una ruta que no existeix mostra la pàgina 404 sense la barra', async () => {
      expect(await carregarApp('/no-existeix')).toBe('/no-existeix')
      await esperaText('Pàgina no trobada')
      expect(barra()).toBeNull()
    })
  })

  describe('amb la 2FA activa i el codi introduït (aal2)', () => {
    beforeEach(() => guardarSessio({ aal: 'aal2', factors: [verifiedFactor] }))

    it('es queda a /perfil', async () => {
      expect(await carregarApp('/perfil')).toBe('/perfil')
    })

    it('es queda a /reset-password', async () => {
      expect(await carregarApp('/reset-password')).toBe('/reset-password')
    })

    it('/mfa redirigeix a /actius', async () => {
      expect(await carregarApp('/mfa')).toBe('/actius')
    })
  })
})
