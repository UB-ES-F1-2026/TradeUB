import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MarketFeed from '../components/MarketFeed.vue'

const ITEMS = [1, 2, 3, 4, 5].map((id) => ({ id, text: `Avís ${id}` }))

// jsdom no té matchMedia: "narrow" simula una pantalla de 900 px o menys
function mockMedia({ narrow = false } = {}) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('max-width') && narrow,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function mountFeed() {
  return mount(MarketFeed, {
    props: { items: ITEMS, label: 'Actualitat del mercat' },
    slots: { item: '<template #item="{ item }">{{ item.text }}</template>' },
  })
}

// La primera targeta que es veu ("N de M"); les altres són inert
function firstVisible(wrapper) {
  return wrapper.findAll('[role="group"]').find((card) => card.attributes('inert') === undefined).attributes('aria-label')
}

function button(wrapper, label) {
  return wrapper.find(`button[aria-label="${label}"]`)
}

describe('MarketFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockMedia()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete window.matchMedia
  })

  // C1: avancen soles cada 6 segons i tornen a començar quan arriben al final
  it('avança una targeta cada 6 segons i torna a la primera després de la darrera', async () => {
    const wrapper = mountFeed()
    expect(firstVisible(wrapper)).toBe('1 de 5')

    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('2 de 5')

    // Amb tres targetes visibles, la darrera posició comença a la 3a; la següent torna a la 1a
    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('3 de 5')
    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('1 de 5')
  })

  // C4: fletxes "Anterior" i "Següent"
  it('les fletxes passen a la targeta següent i a l\'anterior, també en bucle', async () => {
    const wrapper = mountFeed()

    await button(wrapper, 'Següent').trigger('click')
    expect(firstVisible(wrapper)).toBe('2 de 5')

    await button(wrapper, 'Anterior').trigger('click')
    await button(wrapper, 'Anterior').trigger('click')
    expect(firstVisible(wrapper)).toBe('3 de 5')
  })

  // C4: s'aturen amb el ratolí a sobre i tornen a avançar en sortir-ne
  it('no avança mentre el ratolí és a sobre', async () => {
    const wrapper = mountFeed()

    await wrapper.find('section').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('1 de 5')

    await wrapper.find('section').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('2 de 5')
  })

  // C4: s'aturen amb el focus del teclat dins i tornen a avançar en sortir-ne
  it('no avança mentre el focus és dins', async () => {
    const wrapper = mountFeed()

    await button(wrapper, 'Següent').trigger('focusin')
    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('1 de 5')

    await button(wrapper, 'Següent').trigger('focusout', { relatedTarget: null })
    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('2 de 5')
  })

  // C4: "Atura" manté la pausa fins que es prem "Reprèn", encara que el ratolí surti
  it('el botó Atura manté la pausa fins que es prem Reprèn', async () => {
    const wrapper = mountFeed()

    await wrapper.find('section').trigger('mouseenter')
    await button(wrapper, 'Atura les targetes').trigger('click')
    await wrapper.find('section').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(12000)
    expect(firstVisible(wrapper)).toBe('1 de 5')

    await button(wrapper, 'Reprèn les targetes').trigger('click')
    await vi.advanceTimersByTimeAsync(6000)
    expect(firstVisible(wrapper)).toBe('2 de 5')
  })

  // A 900 px o menys es veu una sola targeta, així que es passa per totes
  it('a 900 px o menys passa d\'una en una per totes les targetes', async () => {
    mockMedia({ narrow: true })
    const wrapper = mountFeed()

    await button(wrapper, 'Anterior').trigger('click')
    expect(firstVisible(wrapper)).toBe('5 de 5')
    expect(wrapper.findAll('[role="group"]:not([inert])')).toHaveLength(1)
  })
})
