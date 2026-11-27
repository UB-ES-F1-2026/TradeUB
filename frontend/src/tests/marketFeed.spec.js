import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MarketFeed from '../components/MarketFeed.vue'

const ITEMS = [1, 2, 3, 4, 5].map((id) => ({ id, text: `Avís ${id}` }))
// jsdom no calcula el disseny: es fa veure que cada targeta (amb la separació) fa 200 px, així que una còpia de la
// llista en fa 1000 i, a una targeta cada 6 s, la cinta avança 200 px cada 6 s
const LOOP = 1000

// jsdom no té matchMedia: "reduced" simula que el sistema demana reduir el moviment
function mockMedia({ reduced = false } = {}) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('reduced-motion') && reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

// La primera targeta de la còpia comença on acaba la llista; jsdom tampoc desa scrollLeft
function mockLayout(wrapper) {
  const viewport = wrapper.find('[role="group"][tabindex]').element
  let scrollLeft = 0
  Object.defineProperty(viewport, 'scrollLeft', {
    get: () => scrollLeft,
    set: (value) => {
      scrollLeft = value
    },
  })
  const copy = viewport.querySelector('[data-copy]')
  if (copy) Object.defineProperty(copy, 'offsetLeft', { get: () => LOOP })
  return viewport
}

function mountFeed() {
  const wrapper = mount(MarketFeed, {
    props: { items: ITEMS, label: 'Actualitat del mercat' },
    slots: { item: '<template #item="{ item }">{{ item.text }}</template>' },
    attachTo: document.body,
  })
  return { wrapper, viewport: mockLayout(wrapper) }
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
    document.body.innerHTML = ''
  })

  // C1: les targetes es desplacen soles de manera contínua i tornen a començar quan arriben al final
  it('es desplaça de manera contínua, una targeta cada 6 segons, i torna a començar', async () => {
    const { viewport } = mountFeed()

    await vi.advanceTimersByTimeAsync(3000)
    expect(viewport.scrollLeft).toBeCloseTo(100, -1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(viewport.scrollLeft).toBeCloseTo(200, -1)

    // Després de les 5 targetes (30 s), la cinta torna al principi
    await vi.advanceTimersByTimeAsync(27000)
    expect(viewport.scrollLeft).toBeCloseTo(100, -1)
  })

  // C4: s'atura amb el ratolí a sobre i torna a moure's en sortir-ne
  it('no es mou mentre el ratolí és a sobre', async () => {
    const { wrapper, viewport } = mountFeed()

    await wrapper.find('section').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(6000)
    expect(viewport.scrollLeft).toBe(0)

    await wrapper.find('section').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(6000)
    expect(viewport.scrollLeft).toBeGreaterThan(150)
  })

  // C4: s'atura amb el focus del teclat dins i torna a moure's en sortir-ne
  it('no es mou mentre el focus del teclat és dins', async () => {
    const { viewport } = mountFeed()

    viewport.focus()
    await vi.advanceTimersByTimeAsync(6000)
    expect(viewport.scrollLeft).toBe(0)

    viewport.blur()
    await vi.advanceTimersByTimeAsync(6000)
    expect(viewport.scrollLeft).toBeGreaterThan(150)
  })

  // C4: "Atura" manté la pausa fins que es prem "Reprèn", encara que el ratolí surti
  it('el botó Atura manté la pausa fins que es prem Reprèn', async () => {
    const { wrapper, viewport } = mountFeed()

    await wrapper.find('section').trigger('mouseenter')
    await button(wrapper, 'Atura les targetes').trigger('click')
    await wrapper.find('section').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(12000)
    expect(viewport.scrollLeft).toBe(0)

    await button(wrapper, 'Reprèn les targetes').trigger('click')
    await vi.advanceTimersByTimeAsync(6000)
    expect(viewport.scrollLeft).toBeGreaterThan(150)
  })

  // C5: amb moviment reduït no es mou sola i no hi ha el botó "Atura"
  it('amb moviment reduït no es mou sola ni mostra el botó Atura', async () => {
    mockMedia({ reduced: true })
    const { wrapper, viewport } = mountFeed()

    await vi.advanceTimersByTimeAsync(12000)
    expect(viewport.scrollLeft).toBe(0)
    expect(button(wrapper, 'Atura les targetes').exists()).toBe(false)
  })
})
