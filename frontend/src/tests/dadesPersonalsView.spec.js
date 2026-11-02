import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

import { supabase } from '../services/supabase'
import { useAuthStore } from '../stores/auth'
import DadesPersonalsView from '../views/DadesPersonalsView.vue'

const user = { id: 'u1', email: 'nom@exemple.com', user_metadata: {} }

const validData = {
  Nom: 'Cristian',
  Cognoms: 'Prado',
  'Data de naixement': '1999-05-17',
  Telèfon: '600000000',
  'NIF/NIE': ' 12345678z ',
  'Carrer i número': 'Carrer Gran Via 585',
  'Codi postal': '08007',
  Població: 'Barcelona',
}

function makeRouter(extraRoutes = []) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/onboarding/dades-personals', name: 'onboarding-dades-personals', component: DadesPersonalsView },
      { path: '/perfil', name: 'perfil', component: { render: () => null } },
      ...extraRoutes,
    ],
  })
}

async function mountForm(extraRoutes) {
  const router = makeRouter(extraRoutes)
  router.push('/onboarding/dades-personals')
  await router.isReady()
  const wrapper = mount(DadesPersonalsView, { global: { plugins: [router] } })
  return { wrapper, router }
}

// Cada camp és un .ui-field amb la seva etiqueta
const field = (wrapper, label) =>
  wrapper.findAll('.ui-field').find((f) => f.find('label').text() === label)

async function fillForm(wrapper, data = validData) {
  for (const [label, value] of Object.entries(data)) {
    await field(wrapper, label).find('input').setValue(value)
  }
  await field(wrapper, 'País de residència fiscal').find('select').setValue('ES')
}

const submit = async (wrapper) => {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('DadesPersonalsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    const store = useAuthStore()
    store.user = user
    store.session = { access_token: 'token', user }
    supabase.auth.updateUser.mockImplementation(async ({ data }) => ({
      data: { user: { ...user, user_metadata: data } },
      error: null,
    }))
  })

  it('mostra tots els camps del formulari', async () => {
    const { wrapper } = await mountForm()

    const labels = wrapper.findAll('label').map((l) => l.text())
    expect(labels).toEqual([
      'Nom',
      'Cognoms',
      'Data de naixement',
      'Telèfon',
      'NIF/NIE',
      'Carrer i número',
      'Codi postal',
      'Població',
      'País de residència fiscal',
    ])
  })

  it('ofereix els països de residència fiscal en un desplegable', async () => {
    const { wrapper } = await mountForm()

    const options = field(wrapper, 'País de residència fiscal').findAll('option')
    expect(options[0].text()).toBe('Selecciona un país')
    expect(options.map((o) => o.text())).toContain('Espanya')
  })

  it('no desa si falta algun camp i mostra l\'error', async () => {
    const { wrapper } = await mountForm()

    await submit(wrapper)

    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cal omplir tots els camps obligatoris.')
    expect(wrapper.text()).toContain('Camp obligatori.')
  })

  it('no desa si només falta el país', async () => {
    const { wrapper } = await mountForm()
    for (const [label, value] of Object.entries(validData)) {
      await field(wrapper, label).find('input').setValue(value)
    }

    await submit(wrapper)

    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    expect(field(wrapper, 'País de residència fiscal').text()).toContain('Camp obligatori.')
  })

  it('un camp amb només espais compta com a buit', async () => {
    const { wrapper } = await mountForm()
    await fillForm(wrapper, { ...validData, Nom: '   ' })

    await submit(wrapper)

    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('desa les dades al perfil i marca el pas com a completat', async () => {
    const { wrapper } = await mountForm()
    await fillForm(wrapper)

    await submit(wrapper)

    expect(supabase.auth.updateUser).toHaveBeenCalledOnce()
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: {
        first_name: 'Cristian',
        last_name: 'Prado',
        birthdate: '1999-05-17',
        phone: '600000000',
        nif: '12345678Z',
        street: 'Carrer Gran Via 585',
        postal_code: '08007',
        city: 'Barcelona',
        tax_country: 'ES',
        address: 'Carrer Gran Via 585, 08007 Barcelona',
        onboarding: { 'dades-personals': 'completat' },
      },
    })
  })

  it('conserva l\'estat dels altres passos de l\'onboarding', async () => {
    useAuthStore().user = {
      ...user,
      user_metadata: { onboarding: { 'questionari-inversor': 'completat' } },
    }
    const { wrapper } = await mountForm()
    await fillForm(wrapper)

    await submit(wrapper)

    const { data } = supabase.auth.updateUser.mock.calls[0][0]
    expect(data.onboarding).toEqual({
      'questionari-inversor': 'completat',
      'dades-personals': 'completat',
    })
  })

  it('redirigeix al panell d\'onboarding si existeix', async () => {
    const { wrapper, router } = await mountForm([
      { path: '/onboarding', name: 'onboarding', component: { render: () => null } },
    ])
    await fillForm(wrapper)

    await submit(wrapper)

    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it('redirigeix al perfil mentre el panell d\'onboarding no existeixi', async () => {
    const { wrapper, router } = await mountForm()
    await fillForm(wrapper)

    await submit(wrapper)

    expect(router.currentRoute.value.path).toBe('/perfil')
  })

  it('mostra les dades que l\'usuari ja havia desat', async () => {
    useAuthStore().user = {
      ...user,
      user_metadata: { first_name: 'Anna', tax_country: 'PT' },
    }
    const { wrapper } = await mountForm()

    expect(field(wrapper, 'Nom').find('input').element.value).toBe('Anna')
    expect(field(wrapper, 'País de residència fiscal').find('select').element.value).toBe('PT')
  })

  it('si Supabase falla, mostra l\'error i es queda al formulari', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: new Error('xarxa') })
    const { wrapper, router } = await mountForm()
    await fillForm(wrapper)

    await submit(wrapper)

    expect(wrapper.text()).toContain("No s'han pogut desar les dades.")
    expect(router.currentRoute.value.path).toBe('/onboarding/dades-personals')
  })
})
