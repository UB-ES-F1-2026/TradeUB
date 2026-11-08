import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import QuestionnaireView from '../views/QuestionnaireView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('../services/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))

import { supabase } from '../services/supabase'

// Marca la primera opció de cada pregunta (0 punts → principiant) i envia
async function answerAllAndSubmit(wrapper) {
  for (const question of wrapper.findAll('[data-test="question"]')) {
    await question.find('input[type="radio"]').setValue(true)
  }
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function mountWith(metadata = {}) {
  useAuthStore().user = { id: 'u1', user_metadata: metadata }
  return mount(QuestionnaireView)
}

describe('QuestionnaireView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it("en enviar el qüestionari assigna el perfil i el mostra", async () => {
    supabase.auth.updateUser.mockImplementation(async ({ data }) => ({
      data: { user: { id: 'u1', user_metadata: data } },
      error: null,
    }))
    const wrapper = mountWith()

    await answerAllAndSubmit(wrapper)

    expect(supabase.auth.updateUser).toHaveBeenCalled()
    expect(wrapper.find('[data-test="result"]').text()).toContain('Principiant')
  })

  it('si no es pot desar mostra un error i es queda al qüestionari', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: new Error('Error de xarxa') })
    const wrapper = mountWith()

    await answerAllAndSubmit(wrapper)

    expect(wrapper.text()).toContain("No s'ha pogut desar el teu perfil.")
    expect(wrapper.find('[data-test="result"]').exists()).toBe(false)
  })

  it('si ja té perfil el mostra i permet tornar a fer el qüestionari', async () => {
    const wrapper = mountWith({ investor_profile: { profile: 'avancat', score: 9 } })

    expect(wrapper.find('[data-test="result"]').text()).toContain('Avançat')
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Torna a fer el qüestionari')
    await retry.trigger('click')

    expect(wrapper.findAll('[data-test="question"]')).toHaveLength(5)
  })
})
