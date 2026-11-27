import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiTabs from '../components/ui/UiTabs.vue'

const OPTIONS = [
  { value: 'tots', label: 'Tots' },
  { value: 'accio', label: 'Accions' },
  { value: 'etf', label: 'ETF' },
]

// Amb v-model: cada canvi torna a entrar com a modelValue, com faria el pare
function mountTabs(modelValue = 'tots', props = {}) {
  const wrapper = mount(UiTabs, {
    props: {
      modelValue,
      options: OPTIONS,
      label: "Tipus d'actiu",
      'onUpdate:modelValue': (value) => wrapper.setProps({ modelValue: value }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

const tabs = (wrapper) => wrapper.findAll('[role="tab"]')

describe('UiTabs', () => {
  it('és un tablist amb nom accessible i una pestanya per opció', () => {
    const wrapper = mountTabs()

    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe("Tipus d'actiu")
    expect(tabs(wrapper).map((t) => t.text())).toEqual(['Tots', 'Accions', 'ETF'])
    wrapper.unmount()
  })

  it('marca la pestanya triada i només aquesta entra amb el tabulador', () => {
    const wrapper = mountTabs('accio')

    expect(tabs(wrapper).map((t) => t.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(tabs(wrapper).map((t) => t.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    wrapper.unmount()
  })

  it('en fer clic actualitza el v-model', async () => {
    const wrapper = mountTabs()

    await tabs(wrapper)[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['etf']])
    expect(tabs(wrapper)[2].attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('amb les fletxes canvia de pestanya, dona la volta i mou el focus', async () => {
    const wrapper = mountTabs()

    await tabs(wrapper)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.props('modelValue')).toBe('accio')
    expect(document.activeElement).toBe(tabs(wrapper)[1].element)

    await tabs(wrapper)[1].trigger('keydown', { key: 'ArrowLeft' })
    await tabs(wrapper)[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.props('modelValue')).toBe('etf')
    wrapper.unmount()
  })

  it('Inici i Fi van a la primera i a l\'última pestanya', async () => {
    const wrapper = mountTabs('accio')

    await tabs(wrapper)[1].trigger('keydown', { key: 'End' })
    expect(wrapper.props('modelValue')).toBe('etf')
    await tabs(wrapper)[2].trigger('keydown', { key: 'Home' })
    expect(wrapper.props('modelValue')).toBe('tots')
    wrapper.unmount()
  })

  it('amb controls, cada pestanya apunta al panell', () => {
    const wrapper = mountTabs('tots', { controls: 'resultats' })

    expect(tabs(wrapper).every((t) => t.attributes('aria-controls') === 'resultats')).toBe(true)
    wrapper.unmount()
  })
})
