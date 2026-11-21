import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
}))

import { apiGet } from '../services/api'
import ActiusView from '../views/ActiusView.vue'

// El cercador té els seus propis tests (assetSearch.spec.js)
async function mountActius() {
  const wrapper = mount(ActiusView, { global: { stubs: { AssetSearch: true } } })
  await flushPromises()
  return wrapper
}

describe('ActiusView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('mostra el cercador', async () => {
    const wrapper = await mountActius()

    expect(wrapper.get('h1').text()).toBe('Actius')
    expect(wrapper.findComponent({ name: 'AssetSearch' }).exists()).toBe(true)
  })

  it("no consulta la verificació: cercar no és operar", async () => {
    await mountActius()

    expect(apiGet).not.toHaveBeenCalledWith('/users/me')
  })

  it("ja no mostra el saldo ni l'avís de verificació", async () => {
    const wrapper = await mountActius()

    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(false)
    expect(wrapper.find('[data-test="verification-required"]').exists()).toBe(false)
  })
})
