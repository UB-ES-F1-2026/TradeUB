import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiFileInput from '../components/ui/UiFileInput.vue'

// jsdom no deixa assignar fitxers a un input: es defineix la propietat i es dispara el change
async function select(input, files) {
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
}

describe('UiFileInput', () => {
  it('emet el fitxer triat i buida l\'input per poder tornar a triar el mateix', async () => {
    const wrapper = mount(UiFileInput, { props: { accept: '.png' } })
    const input = wrapper.get('input[type="file"]')
    const file = new File(['x'], 'dni.png', { type: 'image/png' })

    await select(input, [file])

    expect(input.attributes('accept')).toBe('.png')
    expect(wrapper.emitted('change')).toEqual([[file]])
    expect(input.element.value).toBe('')
  })

  it('no emet res si es cancel·la la selecció', async () => {
    const wrapper = mount(UiFileInput)

    await select(wrapper.get('input'), [])

    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('mostra el nom del fitxer en lloc de l\'etiqueta, i l\'error', () => {
    const wrapper = mount(UiFileInput, {
      props: { label: 'Selecciona', fileName: 'dni.png', error: 'Format no vàlid' },
    })

    expect(wrapper.text()).toContain('dni.png')
    expect(wrapper.text()).not.toContain('Selecciona')
    expect(wrapper.text()).toContain('Format no vàlid')
    expect(wrapper.classes()).toContain('ui-file--invalid')
  })
})
