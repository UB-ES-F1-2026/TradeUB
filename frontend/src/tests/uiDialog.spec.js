import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UiDialog from '../components/ui/UiDialog.vue'

// jsdom no implementa showModal: el contingut es mostra segons `open`
function mountDialog(props = {}, slots = {}) {
  return mount(UiDialog, {
    props: { open: true, title: "Detall de l'operació", ...props },
    slots: { default: '<p>Contingut</p>', ...slots },
    attachTo: document.body,
  })
}

describe('UiDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('obert mostra el títol, que dona nom al diàleg, i el contingut', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    const title = wrapper.get('h2')
    expect(title.text()).toBe("Detall de l'operació")
    expect(wrapper.get('dialog').attributes('aria-labelledby')).toBe(title.attributes('id'))
    expect(wrapper.text()).toContain('Contingut')
  })

  it('tancat no mostra res', () => {
    const wrapper = mountDialog({ open: false })

    expect(wrapper.find('[data-test="ui-dialog"]').exists()).toBe(false)
  })

  it('"×" demana tancar-lo, però no es tanca sol', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.get('[data-test="ui-dialog-close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.find('[data-test="ui-dialog"]').exists()).toBe(true)
  })

  it('Esc demana tancar-lo i evita que el navegador el tanqui', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const event = new Event('cancel', { cancelable: true })

    wrapper.get('dialog').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('sense closable no hi ha "×"', async () => {
    const wrapper = mountDialog({ closable: false })
    await flushPromises()

    expect(wrapper.find('[data-test="ui-dialog-close"]').exists()).toBe(false)
  })

  it('en obrir-se, el focus va al primer element que el rep, i en tancar-se torna on era', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const wrapper = mountDialog({ open: false, closable: false }, { default: '<input data-test="camp">' })

    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-test="camp"]').element)

    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(document.activeElement).toBe(opener)
  })

  it('posa les accions del slot "footer" al peu', async () => {
    const wrapper = mountDialog({}, { footer: '<button data-test="tanca">Tanca</button>' })
    await flushPromises()

    expect(wrapper.get('.ui-dialog__footer [data-test="tanca"]').text()).toBe('Tanca')
  })
})
