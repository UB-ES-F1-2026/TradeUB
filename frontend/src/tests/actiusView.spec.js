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

  // Cercar no és operar: sense verificar es veu el cercador, però no es pot triar cap actiu per comprar (US6.1)
  it('sense verificar mostra el cercador però no deixa triar actius', async () => {
    apiGet.mockResolvedValue({ verificacio: { estat: 'pendent', termes_acceptats: false } })
    const wrapper = await mountActius()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(wrapper.findComponent({ name: 'AssetSearch' }).props('selectable')).toBe(false)
  })

  it("ja no mostra el saldo ni l'avís de verificació", async () => {
    const wrapper = await mountActius()

    expect(wrapper.findComponent({ name: 'BalanceCard' }).exists()).toBe(false)
    expect(wrapper.find('[data-test="verification-required"]').exists()).toBe(false)
  })
})
