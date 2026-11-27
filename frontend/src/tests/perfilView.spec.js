import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}))

import { supabase } from '../services/supabase'
import { apiGet, apiPatch } from '../services/api'
import { useAuthStore } from '../stores/auth'
import PerfilView from '../views/PerfilView.vue'

const user = {
  id: 'u1',
  email: 'nom@exemple.com',
  created_at: '2026-10-01T10:00:00Z',
  last_sign_in_at: '2026-10-15T08:30:00Z',
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/perfil', name: 'perfil', component: PerfilView },
      { path: '/login', name: 'login', component: { render: () => null } },
      { path: '/onboarding', name: 'onboarding', component: { render: () => null } },
    ],
  })
}

// attachTo: per als tests de focus, que necessiten el component dins del document
async function mountPerfil(attachTo) {
  const router = makeRouter()
  router.push('/perfil')
  await router.isReady()
  // Les seccions de 2FA i de contrasenya tenen els seus propis tests (twoFactorCard.spec.js, passwordCard.spec.js)
  const wrapper = mount(PerfilView, {
    global: { plugins: [router], stubs: { TwoFactorCard: true, PasswordCard: true } },
    attachTo,
  })
  return { wrapper, router }
}

// Respostes del backend simulat, per ruta
let backend

describe('PerfilView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    backend = { '/users/me': { perfil: {} } }
    apiGet.mockImplementation(async (path) => backend[path])
    setActivePinia(createPinia())
    const store = useAuthStore()
    store.user = user
    store.session = { access_token: 'token', user }
  })

  it('carrega el saldo encara que la cartera no sigui visible', async () => {
    backend['/account/balance'] = { balance: '10000', currency: 'EUR', updated_at: null }

    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(apiGet).toHaveBeenCalledWith('/account/balance')
    expect(wrapper.text()).not.toContain('Patrimoni')
  })

  it('mostra el correu i les dates de l\'usuari', async () => {
    const { wrapper } = await mountPerfil()

    expect(wrapper.text()).toContain('nom@exemple.com')
    expect(wrapper.text()).toContain('Compte creat')
    expect(wrapper.text()).toContain('Últim inici de sessió')
  })

  it('mostra l\'identificador de l\'usuari', async () => {
    const { wrapper } = await mountPerfil()

    expect(wrapper.text()).toContain('u1')
  })

  it('mostra el nom complet i les dades personals que retorna el backend', async () => {
    backend['/users/me'] = {
      perfil: {
        nom: 'Cristian',
        cognoms: 'Prado',
        telefon: '600000000',
        data_naixement: '2003-01-11',
        carrer: 'Carrer Gran Via 585',
        codi_postal: '08007',
        poblacio: 'Barcelona',
      },
    }
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(wrapper.find('h1').text()).toBe('Perfil')
    expect(wrapper.find('.page__name').text()).toBe('Cristian Prado')
    expect(wrapper.text()).toContain('600000000')
    expect(wrapper.text()).toContain('Carrer Gran Via 585, 08007 Barcelona')
  })

  it('mostra un guió quan una dada personal encara no existeix', async () => {
    const { wrapper } = await mountPerfil()

    expect(wrapper.find('h1').text()).toBe('Perfil')
    expect(wrapper.text()).toContain('Data de naixement')
    expect(wrapper.findAll('dd').some((dd) => dd.text() === '—')).toBe(true)
  })

  it('indica que el compte no està verificat i ofereix el botó de verificar', async () => {
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(wrapper.text()).toContain('No verificat')
    expect(wrapper.text()).toContain("Verifica't")
  })

  it("el botó de verificar porta a la pantalla de l'onboarding", async () => {
    const { wrapper, router } = await mountPerfil()
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === "Verifica't").trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/onboarding')
  })

  it('indica que el compte està verificat segons el backend i amaga el botó de verificar', async () => {
    backend['/users/me'] = { perfil: {}, verificacio: { estat: 'verificat', termes_acceptats: true } }
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(wrapper.text()).toContain('Verificat')
    expect(wrapper.text()).not.toContain('No verificat')
    expect(wrapper.text()).not.toContain("Verifica't")
  })

  it('mostra la targeta del PIN només als usuaris verificats', async () => {
    const { wrapper: noVerificat } = await mountPerfil()
    await flushPromises()
    expect(noVerificat.text()).not.toContain('PIN de seguretat')

    backend['/users/me'] = { perfil: {}, verificacio: { estat: 'verificat', termes_acceptats: true } }
    const { wrapper: verificat } = await mountPerfil()
    await flushPromises()
    expect(verificat.text()).toContain('PIN de seguretat')
  })

  it('no el dona per verificat sense els termes acceptats', async () => {
    backend['/users/me'] = { perfil: {}, verificacio: { estat: 'verificat', termes_acceptats: false } }
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(wrapper.text()).toContain('No verificat')
  })

  it('ignora el marcador antic de user_metadata', async () => {
    useAuthStore().user = { ...user, user_metadata: { verified: true } }
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(wrapper.text()).toContain('No verificat')
  })

  it("mostra l'apartat de contrasenya a qualsevol usuari registrat", async () => {
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'PasswordCard' }).exists()).toBe(true)
  })

  it('oculta la configuració encara no disponible', async () => {
    const { wrapper } = await mountPerfil()

    expect(wrapper.text()).not.toContain('Pròximament')
    expect(wrapper.text()).not.toContain('Configuració')
    expect(wrapper.findAll('a').some((a) => a.attributes('href') === '/ajustes')).toBe(false)
  })

  it('tanca la sessió i redirigeix a /login', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null })
    const { wrapper, router } = await mountPerfil()

    const button = wrapper.findAll('button').find((b) => b.text() === 'Tanca la sessió')
    await button.trigger('click')
    await flushPromises()

    expect(supabase.auth.signOut).toHaveBeenCalledOnce()
    expect(useAuthStore().session).toBeNull()
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('si Supabase falla, mostra l\'error i es queda al perfil', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: new Error('xarxa') })
    const { wrapper, router } = await mountPerfil()

    const button = wrapper.findAll('button').find((b) => b.text() === 'Tanca la sessió')
    await button.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("No s'ha pogut tancar la sessió")
    expect(router.currentRoute.value.path).toBe('/perfil')
  })
})

describe('PerfilView: edició de les dades personals (US4.1)', () => {
  const perfil = {
    nom: 'Cristian',
    cognoms: 'Prado',
    telefon: '600000000',
    data_naixement: '2003-01-11',
    carrer: 'Carrer Gran Via 585',
    codi_postal: '08007',
    poblacio: 'Barcelona',
  }
  const completed = { steps: [{ id: 'dades-personals', status: 'completat' }] }

  const editButton = (wrapper) => wrapper.find('[data-test="edit-personal-data"]')

  beforeEach(() => {
    vi.clearAllMocks()
    backend = { '/users/me': { perfil, onboarding: completed } }
    apiGet.mockImplementation(async (path) => backend[path])
    setActivePinia(createPinia())
    const store = useAuthStore()
    store.user = user
    store.session = { access_token: 'token', user }
  })

  it('sense el pas "Dades personals" completat no es pot editar', async () => {
    backend['/users/me'] = { perfil, onboarding: { steps: [{ id: 'dades-personals', status: 'pendent' }] } }
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(editButton(wrapper).exists()).toBe(false)
  })

  it('amb el pas completat es pot editar encara que no estigui verificat', async () => {
    const { wrapper } = await mountPerfil()
    await flushPromises()

    expect(wrapper.text()).toContain('No verificat')
    expect(editButton(wrapper).exists()).toBe(true)
  })

  it('"Edita" obre el formulari i "Cancel·la" torna a la lectura', async () => {
    const { wrapper } = await mountPerfil()
    await flushPromises()

    await editButton(wrapper).trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(editButton(wrapper).exists()).toBe(false)

    await wrapper.findAll('button').find((b) => b.text() === 'Cancel·la').trigger('click')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Carrer Gran Via 585, 08007 Barcelona')
  })

  it('en desar torna a la lectura amb les dades noves', async () => {
    apiPatch.mockResolvedValue({})
    const { wrapper } = await mountPerfil()
    await flushPromises()
    await editButton(wrapper).trigger('click')

    const input = wrapper.findAll('.ui-field').find((f) => f.find('label').text() === 'Població').find('input')
    await input.setValue('Girona')
    backend['/users/me'] = { perfil: { ...perfil, poblacio: 'Girona' }, onboarding: completed }
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(apiPatch).toHaveBeenCalledWith('/profile/personal-data', expect.objectContaining({ poblacio: 'Girona' }))
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Carrer Gran Via 585, 08007 Girona')
  })

  it('el focus va al primer camp en editar i torna a "Edita" en cancel·lar', async () => {
    const { wrapper } = await mountPerfil(document.body)
    await flushPromises()

    await editButton(wrapper).trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('form input').element)

    await wrapper.findAll('button').find((b) => b.text() === 'Cancel·la').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(editButton(wrapper).element)
    wrapper.unmount()
  })
})
