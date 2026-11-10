import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppNavBar from '../components/AppNavBar.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

describe('AppNavBar', () => {
  it('oculta els enllaços a vistes inacabades', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/actius', component: { template: '<div />' } }],
    })
    await router.push('/actius')
    await router.isReady()

    const wrapper = mount(AppNavBar, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Actius')
    expect(wrapper.text()).toContain('Perfil')
    expect(wrapper.text()).not.toContain('Cartera')
    expect(wrapper.text()).not.toContain('Historial')
    expect(wrapper.text()).not.toContain('Bústia')
    expect(wrapper.text()).not.toContain("Compte d'efectiu")
  })
})
