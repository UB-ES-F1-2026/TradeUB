import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { supabase } from '../services/supabase'
import ResetPasswordView from '../views/ResetPasswordView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../services/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn(), signOut: vi.fn() } },
}))

const mountView = () =>
  mount(ResetPasswordView, {
    global: { plugins: [createPinia()], stubs: { RouterLink: true } },
  })

describe('ResetPasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = ''
  })

  it("mostra l'avís si l'enllaç ha caducat", () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired'
    const wrapper = mountView()
    expect(wrapper.text()).toContain("L'enllaç de recuperació ha caducat o ja s'ha utilitzat")
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('no crida Supabase si la contrasenya no compleix els requisits', async () => {
    const wrapper = mountView()
    const [pass, confirm] = wrapper.findAll('input')
    await pass.setValue('curta')
    await confirm.setValue('curta')
    await wrapper.find('form').trigger('submit')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('no crida Supabase si les contrasenyes no coincideixen', async () => {
    const wrapper = mountView()
    const [pass, confirm] = wrapper.findAll('input')
    await pass.setValue('abcdefg1')
    await confirm.setValue('abcdefg2')
    await wrapper.find('form').trigger('submit')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('canvia la contrasenya, tanca sessió i va a /login', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
    const wrapper = mountView()
    const [pass, confirm] = wrapper.findAll('input')
    await pass.setValue('abcdefg1')
    await confirm.setValue('abcdefg1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'abcdefg1' })
    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/login')
  })
})