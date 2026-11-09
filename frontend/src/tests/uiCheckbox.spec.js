import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiCheckbox from '../components/ui/UiCheckbox.vue'

describe('UiCheckbox', () => {
  it("enllaça l'etiqueta amb la casella", () => {
    const wrapper = mount(UiCheckbox, { props: { label: 'Accepto' } })

    const input = wrapper.get('input[type="checkbox"]')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get('label').text()).toBe('Accepto')
  })

  it('actualitza el v-model en marcar i desmarcar', async () => {
    const wrapper = mount(UiCheckbox, {
      props: { modelValue: false, 'onUpdate:modelValue': (v) => wrapper.setProps({ modelValue: v }) },
    })

    await wrapper.get('input').setValue(true)
    expect(wrapper.props('modelValue')).toBe(true)
    await wrapper.get('input').setValue(false)
    expect(wrapper.props('modelValue')).toBe(false)
  })

  it('es pot desactivar', () => {
    const wrapper = mount(UiCheckbox, { props: { disabled: true } })

    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
  })

  it("mostra l'error en lloc de l'ajuda", () => {
    const wrapper = mount(UiCheckbox, { props: { hint: 'Ajuda', error: 'Cal acceptar-los' } })

    expect(wrapper.text()).toContain('Cal acceptar-los')
    expect(wrapper.text()).not.toContain('Ajuda')
  })

  it("passa els atributs a l'input", () => {
    const wrapper = mount(UiCheckbox, { attrs: { 'data-test': 'casella' } })

    expect(wrapper.get('input').attributes('data-test')).toBe('casella')
  })
})
