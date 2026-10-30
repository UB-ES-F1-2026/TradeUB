import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiRadioGroup from '../components/ui/UiRadioGroup.vue'

const options = [
  { id: 'a', label: 'Opció A' },
  { id: 'b', label: 'Opció B' },
]

const mountGroup = (modelValue = '') =>
  mount(UiRadioGroup, {
    props: {
      options,
      name: 'pregunta',
      label: 'Pregunta de prova',
      modelValue,
      'onUpdate:modelValue': (value) => wrapper.setProps({ modelValue: value }),
    },
  })

let wrapper

describe('UiRadioGroup', () => {
  it('mostra una opció per element, totes amb el mateix name', () => {
    wrapper = mountGroup()
    const radios = wrapper.findAll('input[type="radio"]')

    expect(radios).toHaveLength(2)
    expect(radios.every((r) => r.attributes('name') === 'pregunta')).toBe(true)
    expect(wrapper.text()).toContain('Opció A')
    expect(wrapper.attributes('role')).toBe('radiogroup')
    expect(wrapper.attributes('aria-label')).toBe('Pregunta de prova')
  })

  it("actualitza el v-model i marca l'opció triada", async () => {
    wrapper = mountGroup()

    await wrapper.findAll('input[type="radio"]')[1].setValue(true)

    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['b'])
    expect(wrapper.findAll('label')[1].classes()).toContain('ui-radio--selected')
    expect(wrapper.findAll('label')[0].classes()).not.toContain('ui-radio--selected')
  })
})
