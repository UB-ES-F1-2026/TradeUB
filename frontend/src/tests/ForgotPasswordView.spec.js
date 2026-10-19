import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { supabase } from '../services/supabase'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('../services/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn() } },
}))

const mountView = () =>
  mount(ForgotPasswordView, {
    global: { plugins: [createPinia()], stubs: { RouterLink: true } },
  })

describe('ForgotPasswordView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no envia res si el correu no és vàlid', async () => {
    const wrapper = mountView()
    await wrapper.find('input').setValue('no-es-un-correu')
    await wrapper.find('form').trigger('submit')
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it("mostra l'avís genèric amb un correu vàlid", async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const wrapper = mountView()
    await wrapper.find('input').setValue('a@b.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Si el correu existeix al nostre sistema')
  })

  it('mostra el mateix avís encara que Supabase doni error', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: new Error('x') })
    const wrapper = mountView()
    await wrapper.find('input').setValue('a@b.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Si el correu existeix al nostre sistema')
  })
})