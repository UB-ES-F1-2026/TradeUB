import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiPage from '../components/ui/UiPage.vue'

describe('UiPage', () => {
  it('mostra el títol com a h1 i el contingut', () => {
    const wrapper = mount(UiPage, {
      props: { title: 'Actius' },
      slots: { default: '<p>Contingut</p>' },
    })

    expect(wrapper.get('h1').text()).toBe('Actius')
    expect(wrapper.text()).toContain('Contingut')
  })

  it("posa l'acció a la dreta de la capçalera", () => {
    const wrapper = mount(UiPage, {
      props: { title: 'Actius' },
      slots: { actions: '<span data-test="accio">Preus simulats</span>' },
    })

    expect(wrapper.get('.ui-page__actions [data-test="accio"]').text()).toBe('Preus simulats')
  })

  it("sense acció no hi ha el contenidor de l'acció", () => {
    const wrapper = mount(UiPage, { props: { title: 'Historial' } })

    expect(wrapper.find('.ui-page__actions').exists()).toBe(false)
  })

  it('el títol es pot substituir pel slot "title"', () => {
    const wrapper = mount(UiPage, {
      slots: { title: '<h1 data-test="nom">Anna Puig</h1>' },
    })

    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('[data-test="nom"]').text()).toBe('Anna Puig')
  })
})
