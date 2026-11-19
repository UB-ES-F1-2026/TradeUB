import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Supabase i API falsos: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost, ApiError } from '../services/api'
import PinCard from '../components/PinCard.vue'

// GET /profile/pin diu si l'usuari ja té PIN
async function mountCard({ hasPin = false } = {}) {
  apiGet.mockResolvedValue({ configurat: hasPin })
  const wrapper = mount(PinCard)
  await flushPromises()
  return wrapper
}

function button(wrapper, text) {
  return wrapper.findAll('button').find((b) => b.text() === text)
}

function field(wrapper, label) {
  const labelEl = wrapper.findAll('label').find((l) => l.text() === label)
  return wrapper.find(`#${labelEl.attributes('for')}`)
}

async function fill(wrapper, values) {
  for (const [label, value] of Object.entries(values)) {
    await field(wrapper, label).setValue(value)
  }
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('PinCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('sense PIN', () => {
    it('indica que no està configurat i ofereix configurar-lo', async () => {
      const wrapper = await mountCard()

      expect(wrapper.text()).toContain('Sense configurar')
      expect(button(wrapper, 'Configurar el PIN')).toBeTruthy()
    })

    it('el formulari no demana el PIN actual', async () => {
      const wrapper = await mountCard()
      await button(wrapper, 'Configurar el PIN').trigger('click')

      const labels = wrapper.findAll('label').map((l) => l.text())
      expect(labels).toEqual(['PIN', 'Repeteix el PIN'])
    })

    it('amb un PIN vàlid repetit igual el desa i queda configurat', async () => {
      apiPost.mockResolvedValue({})
      const wrapper = await mountCard()
      await button(wrapper, 'Configurar el PIN').trigger('click')

      await fill(wrapper, { PIN: '1234', 'Repeteix el PIN': '1234' })

      expect(apiPost).toHaveBeenCalledWith('/profile/pin', { pin: '1234' })
      expect(wrapper.text()).toContain('PIN de seguretat configurat.')
      expect(wrapper.text()).toContain('Configurat')
      expect(wrapper.find('form').exists()).toBe(false)
    })

    it('si el PIN no té 4 dígits mostra l\'error i no l\'envia', async () => {
      const wrapper = await mountCard()
      await button(wrapper, 'Configurar el PIN').trigger('click')

      await fill(wrapper, { PIN: '12', 'Repeteix el PIN': '12' })

      expect(wrapper.text()).toContain('El PIN ha de tenir 4 dígits.')
      expect(apiPost).not.toHaveBeenCalled()
    })

    it('si els dos PIN no coincideixen mostra l\'error i no l\'envia', async () => {
      const wrapper = await mountCard()
      await button(wrapper, 'Configurar el PIN').trigger('click')

      await fill(wrapper, { PIN: '1234', 'Repeteix el PIN': '4321' })

      expect(wrapper.text()).toContain('Els PIN no coincideixen.')
      expect(apiPost).not.toHaveBeenCalled()
    })

    it('si el backend falla mostra un error general i manté el formulari', async () => {
      apiPost.mockRejectedValue(new ApiError(500, 'Error del servidor'))
      const wrapper = await mountCard()
      await button(wrapper, 'Configurar el PIN').trigger('click')

      await fill(wrapper, { PIN: '1234', 'Repeteix el PIN': '1234' })

      expect(wrapper.text()).toContain("No s'ha pogut desar el PIN. Torna-ho a provar.")
      expect(wrapper.text()).toContain('Sense configurar')
      expect(wrapper.find('form').exists()).toBe(true)
    })

    it('si ja hi havia un PIN, passa a canviar-lo sense perdre el PIN nou', async () => {
      apiPost.mockRejectedValue(new ApiError(403, 'El PIN actual és incorrecte.'))
      const wrapper = await mountCard()
      await button(wrapper, 'Configurar el PIN').trigger('click')

      await fill(wrapper, { PIN: '1234', 'Repeteix el PIN': '1234' })

      expect(wrapper.text()).toContain('Ja tens un PIN configurat. Escriu el PIN actual per canviar-lo.')
      expect(wrapper.text()).toContain('Configurat')
      expect(field(wrapper, 'PIN actual').exists()).toBe(true)
      expect(field(wrapper, 'PIN nou').element.value).toBe('1234')
      expect(field(wrapper, 'Repeteix el PIN nou').element.value).toBe('1234')

      apiPost.mockResolvedValue({})
      await fill(wrapper, { 'PIN actual': '5678' })
      expect(apiPost).toHaveBeenLastCalledWith('/profile/pin', { pin: '1234', pin_actual: '5678' })
    })

    it('cancel·lar tanca el formulari sense enviar res', async () => {
      const wrapper = await mountCard()
      await button(wrapper, 'Configurar el PIN').trigger('click')

      await button(wrapper, 'Cancel·lar').trigger('click')

      expect(wrapper.find('form').exists()).toBe(false)
      expect(apiPost).not.toHaveBeenCalled()
    })
  })

  describe("estat del PIN", () => {
    it('mostra que està comprovant el PIN mentre el backend respon', async () => {
      apiGet.mockReturnValue(new Promise(() => {}))
      const wrapper = mount(PinCard)
      await flushPromises()

      expect(wrapper.text()).toContain('Comprovant el PIN…')
      expect(button(wrapper, 'Configurar el PIN')).toBeUndefined()
    })

    it('si no es pot comprovar, "Torna-ho a provar" ho torna a demanar', async () => {
      apiGet.mockRejectedValueOnce(new ApiError(500, "No s'ha pogut recuperar el PIN"))
      const wrapper = mount(PinCard)
      await flushPromises()

      expect(wrapper.text()).toContain("No s'ha pogut comprovar el PIN. Torna-ho a provar.")
      apiGet.mockResolvedValue({ configurat: false })
      await button(wrapper, 'Torna-ho a provar').trigger('click')
      await flushPromises()

      expect(apiGet).toHaveBeenCalledTimes(2)
      expect(apiGet).toHaveBeenLastCalledWith('/profile/pin')
      expect(button(wrapper, 'Configurar el PIN')).toBeTruthy()
      expect(wrapper.text()).not.toContain("No s'ha pogut comprovar el PIN")
    })
  })

  describe('amb PIN', () => {
    it('indica que està configurat i ofereix canviar-lo', async () => {
      const wrapper = await mountCard({ hasPin: true })

      expect(wrapper.text()).toContain('Configurat')
      expect(button(wrapper, 'Canviar el PIN')).toBeTruthy()
    })

    it('per canviar-lo demana el PIN actual i l\'envia', async () => {
      apiPost.mockResolvedValue({})
      const wrapper = await mountCard({ hasPin: true })
      await button(wrapper, 'Canviar el PIN').trigger('click')

      await fill(wrapper, { 'PIN actual': '1234', 'PIN nou': '5678', 'Repeteix el PIN nou': '5678' })

      expect(apiPost).toHaveBeenCalledWith('/profile/pin', { pin: '5678', pin_actual: '1234' })
      expect(wrapper.text()).toContain('PIN de seguretat canviat.')
    })

    it('si el PIN actual és incorrecte, mostra l\'error al camp i el buida', async () => {
      apiPost.mockRejectedValue(new ApiError(403, 'El PIN actual és incorrecte.'))
      const wrapper = await mountCard({ hasPin: true })
      await button(wrapper, 'Canviar el PIN').trigger('click')

      await fill(wrapper, { 'PIN actual': '0000', 'PIN nou': '5678', 'Repeteix el PIN nou': '5678' })

      expect(wrapper.text()).toContain('El PIN actual és incorrecte.')
      expect(field(wrapper, 'PIN actual').element.value).toBe('')
      expect(wrapper.find('form').exists()).toBe(true)
    })

    it('no envia res sense el PIN actual', async () => {
      const wrapper = await mountCard({ hasPin: true })
      await button(wrapper, 'Canviar el PIN').trigger('click')

      await fill(wrapper, { 'PIN nou': '5678', 'Repeteix el PIN nou': '5678' })

      expect(wrapper.text()).toContain('El PIN ha de tenir 4 dígits.')
      expect(apiPost).not.toHaveBeenCalled()
    })
  })
})
