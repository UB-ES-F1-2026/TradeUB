import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

import NotFoundView from '../views/NotFoundView.vue'
import { useAuthStore } from '../stores/auth'

const base64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '')
// Sessió amb el nivell indicat; amb un factor verificat i aal1, el codi de la 2FA és pendent
function iniciaSessio({ aal = 'aal1', factors = [] } = {}) {
  const store = useAuthStore()
  const user = { id: 'u1', factors }
  store.user = user
  store.session = { access_token: `${base64({ alg: 'HS256' })}.${base64({ sub: 'u1', aal })}.signatura`, user }
}

async function mountNotFound() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/actius', name: 'actius', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
    ],
  })
  await router.push('/no-existeix')
  await router.isReady()
  const wrapper = mount(NotFoundView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('NotFoundView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('amb sessió fa servir el contenidor comú amb el títol', async () => {
    iniciaSessio()
    const { wrapper } = await mountNotFound()

    expect(wrapper.find('.ui-page').exists()).toBe(true)
    expect(wrapper.get('h1').text()).toBe('Pàgina no trobada')
  })

  it('sense sessió es mostra centrada, fora del contenidor comú', async () => {
    const { wrapper } = await mountNotFound()

    expect(wrapper.find('.ui-page').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe('Pàgina no trobada')
  })

  it('amb el codi de la 2FA pendent es mostra com sense sessió', async () => {
    iniciaSessio({ aal: 'aal1', factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] })
    const { wrapper } = await mountNotFound()

    expect(wrapper.find('.ui-page').exists()).toBe(false)
  })

  it('"Torna a l\'inici" porta a Actius', async () => {
    iniciaSessio()
    const { wrapper, router } = await mountNotFound()

    await wrapper.get('[data-test="not-found-home"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/actius')
  })
})
