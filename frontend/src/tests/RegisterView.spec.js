import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { supabase } from '../services/supabase'
import RegisterView from '../views/RegisterView.vue'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('../services/supabase', () => ({
  supabase: { auth: { signUp: vi.fn(), resend: vi.fn() } },
}))

const mountView = () =>
  mount(RegisterView, {
    global: { plugins: [createPinia()], stubs: { RouterLink: true } },
  })

// Omple els 4 camps (correu, repeteix correu, contrasenya, repeteix contrasenya) i envia
async function fillAndSubmit(wrapper, { email, emailConfirm, pass, passConfirm }) {
  const [e, ec, p, pc] = wrapper.findAll('input')
  await e.setValue(email)
  await ec.setValue(emailConfirm)
  await p.setValue(pass)
  await pc.setValue(passConfirm)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

const validData = {
  email: 'a@b.com',
  emailConfirm: 'a@b.com',
  pass: 'abcdefg1',
  passConfirm: 'abcdefg1',
}

describe('RegisterView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no registra si el correu no és vàlid', async () => {
    const wrapper = mountView()
    await fillAndSubmit(wrapper, {
      ...validData, email: 'no-es-un-correu', emailConfirm: 'no-es-un-correu',
    })
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('no registra si els correus no coincideixen', async () => {
    const wrapper = mountView()
    await fillAndSubmit(wrapper, { ...validData, emailConfirm: 'x@b.com' })
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('no registra si la contrasenya no compleix els requisits', async () => {
    const wrapper = mountView()
    await fillAndSubmit(wrapper, { ...validData, pass: 'curta', passConfirm: 'curta' })
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('no registra si les contrasenyes no coincideixen', async () => {
    const wrapper = mountView()
    await fillAndSubmit(wrapper, { ...validData, passConfirm: 'abcdefg2' })
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('detecta un correu ja registrat (identities buides)', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { identities: [] } },
      error: null,
    })
    const wrapper = mountView()
    await fillAndSubmit(wrapper, validData)
    expect(wrapper.text()).toContain('Aquest correu ja està registrat.')
  })

  it("mostra l'error de Supabase si el registre falla", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: new Error('Error de xarxa'),
    })
    const wrapper = mountView()
    await fillAndSubmit(wrapper, validData)
    expect(wrapper.text()).toContain('Error de xarxa')
  })

  it('mostra la pantalla de revisar el correu si tot va bé', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { identities: [{ id: 1 }] } },
      error: null,
    })
    const wrapper = mountView()
    await fillAndSubmit(wrapper, validData)
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'abcdefg1',
    })
    expect(wrapper.text()).toContain('Revisa el teu correu')
    wrapper.unmount() // atura el comptador del reenviament
  })
})