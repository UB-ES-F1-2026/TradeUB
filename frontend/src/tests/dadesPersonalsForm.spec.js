import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Supabase fals: cap crida de xarxa ni variables d'entorn
vi.mock('../services/supabase', () => ({ supabase: { auth: {} } }))

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}))

import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import { useProfileStore } from '../stores/profile'
import DadesPersonalsForm from '../components/DadesPersonalsForm.vue'

const validData = {
  Nom: 'Cristian',
  Cognoms: 'Prado',
  'Data de naixement': '1999-05-17',
  Telèfon: '600000000',
  'NIF/NIE': ' 12345678z ',
  'Carrer i número': 'Carrer Gran Via 585',
  'Codi postal': '08007',
  Població: 'Barcelona',
}

async function mountForm() {
  const wrapper = mount(DadesPersonalsForm)
  await flushPromises()
  return wrapper
}

// Cada camp és un .ui-field amb la seva etiqueta
const field = (wrapper, label) =>
  wrapper.findAll('.ui-field').find((f) => f.find('label').text() === label)

async function fillForm(wrapper, data = validData) {
  for (const [label, value] of Object.entries(data)) {
    await field(wrapper, label).find('input').setValue(value)
  }
  await field(wrapper, 'País de residència fiscal').find('select').setValue('ES')
}

const submit = async (wrapper) => {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('DadesPersonalsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    apiGet.mockResolvedValue({ perfil: {} })
    apiPost.mockResolvedValue({})
  })

  it('mostra tots els camps del formulari', async () => {
    const wrapper = await mountForm()

    const labels = wrapper.findAll('label').map((l) => l.text())
    expect(labels).toEqual([
      'Nom',
      'Cognoms',
      'Data de naixement',
      'Telèfon',
      'NIF/NIE',
      'Carrer i número',
      'Codi postal',
      'Població',
      'País de residència fiscal',
    ])
  })

  it('ofereix els països de residència fiscal en un desplegable', async () => {
    const wrapper = await mountForm()

    const options = field(wrapper, 'País de residència fiscal').findAll('option')
    expect(options[0].text()).toBe('Selecciona un país')
    expect(options.map((o) => o.text())).toContain('Espanya')
  })

  it('no envia res si falta algun camp i mostra l\'error', async () => {
    const wrapper = await mountForm()

    await submit(wrapper)

    expect(apiPost).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cal omplir tots els camps obligatoris.')
    expect(wrapper.text()).toContain('Camp obligatori.')
  })

  it('no envia res si només falta el país', async () => {
    const wrapper = await mountForm()
    for (const [label, value] of Object.entries(validData)) {
      await field(wrapper, label).find('input').setValue(value)
    }

    await submit(wrapper)

    expect(apiPost).not.toHaveBeenCalled()
    expect(field(wrapper, 'País de residència fiscal').text()).toContain('Camp obligatori.')
  })

  it('un camp amb només espais compta com a buit', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper, { ...validData, Nom: '   ' })

    await submit(wrapper)

    expect(apiPost).not.toHaveBeenCalled()
  })

  it('no envia res si el NIF/NIE té la lletra de control incorrecta i ho indica al camp', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper, { ...validData, 'NIF/NIE': '12345678A' })

    await submit(wrapper)

    expect(apiPost).not.toHaveBeenCalled()
    expect(field(wrapper, 'NIF/NIE').text()).toContain('El format del NIF/NIE no és vàlid.')
    expect(field(wrapper, 'Nom').text()).not.toContain('no és vàlid')
  })

  it('accepta un NIE vàlid', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper, { ...validData, 'NIF/NIE': 'x0000000t' })

    await submit(wrapper)

    expect(apiPost).toHaveBeenCalledOnce()
    expect(apiPost.mock.calls[0][1].nif).toBe('X0000000T')
  })

  it('un NIF buit demana el camp i no el format', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper, { ...validData, 'NIF/NIE': '' })

    await submit(wrapper)

    expect(field(wrapper, 'NIF/NIE').text()).toContain('Camp obligatori.')
    expect(field(wrapper, 'NIF/NIE').text()).not.toContain('no és vàlid')
  })

  it('envia les dades al backend i avisa que s\'han desat', async () => {
    const wrapper = await mountForm()
    await fillForm(wrapper)

    await submit(wrapper)

    expect(apiPost).toHaveBeenCalledOnce()
    expect(apiPost).toHaveBeenCalledWith('/profile/personal-data', {
      nom: 'Cristian',
      cognoms: 'Prado',
      data_naixement: '1999-05-17',
      telefon: '600000000',
      nif: '12345678Z',
      carrer: 'Carrer Gran Via 585',
      codi_postal: '08007',
      poblacio: 'Barcelona',
      residencia_fiscal: 'ES',
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('mostra les dades que el backend ja tenia desades', async () => {
    apiGet.mockResolvedValue({ perfil: { nom: 'Anna', residencia_fiscal: 'PT' } })

    const wrapper = await mountForm()

    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(field(wrapper, 'Nom').find('input').element.value).toBe('Anna')
    expect(field(wrapper, 'País de residència fiscal').find('select').element.value).toBe('PT')
  })

  it('si el backend rebutja el NIF/NIE, ho mostra al camp i no avisa que s\'ha desat', async () => {
    apiPost.mockRejectedValue(new ApiError(422, 'El format del NIF/NIE no és vàlid.'))
    const wrapper = await mountForm()
    await fillForm(wrapper)

    await submit(wrapper)

    expect(field(wrapper, 'NIF/NIE').text()).toContain('El format del NIF/NIE no és vàlid.')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('l\'error del backend al NIF/NIE desapareix quan l\'usuari el canvia', async () => {
    apiPost.mockRejectedValue(new ApiError(422, 'El format del NIF/NIE no és vàlid.'))
    const wrapper = await mountForm()
    await fillForm(wrapper)
    await submit(wrapper)

    await field(wrapper, 'NIF/NIE').find('input').setValue('X0000000T')

    expect(field(wrapper, 'NIF/NIE').text()).not.toContain('no és vàlid')
  })

  it('si el backend falla, mostra l\'error general i no avisa que s\'ha desat', async () => {
    apiPost.mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const wrapper = await mountForm()
    await fillForm(wrapper)

    await submit(wrapper)

    expect(wrapper.text()).toContain("No s'han pogut desar les dades.")
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})

describe('DadesPersonalsForm en mode edició (US4.1)', () => {
  const saved = {
    nom: 'Cristian',
    cognoms: 'Prado',
    telefon: '600000000',
    data_naixement: '1999-05-17',
    nif: '12345678Z',
    carrer: 'Carrer Gran Via 585',
    codi_postal: '08007',
    poblacio: 'Barcelona',
    residencia_fiscal: 'ES',
  }

  async function mountEdit() {
    useProfileStore().perfil = { ...saved }
    const wrapper = mount(DadesPersonalsForm, { props: { mode: 'edit' } })
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    apiGet.mockResolvedValue({ perfil: saved })
    apiPatch.mockResolvedValue({})
  })

  it('només mostra els camps editables, amb les dades desades', async () => {
    const wrapper = await mountEdit()

    const labels = wrapper.findAll('label').map((l) => l.text())
    expect(labels).toEqual(['Nom', 'Cognoms', 'Telèfon', 'Carrer i número', 'Codi postal', 'Població'])
    expect(field(wrapper, 'Nom').find('input').element.value).toBe('Cristian')
    expect(field(wrapper, 'Població').find('input').element.value).toBe('Barcelona')
  })

  it('no torna a demanar el perfil en obrir-se', async () => {
    await mountEdit()

    expect(apiGet).not.toHaveBeenCalled()
  })

  it('envia només els camps editables, nets, i avisa que s\'ha desat', async () => {
    const wrapper = await mountEdit()
    await field(wrapper, 'Telèfon').find('input').setValue(' 611111111 ')

    await submit(wrapper)

    expect(apiPatch).toHaveBeenCalledWith('/profile/personal-data', {
      nom: 'Cristian',
      cognoms: 'Prado',
      telefon: '611111111',
      carrer: 'Carrer Gran Via 585',
      codi_postal: '08007',
      poblacio: 'Barcelona',
    })
    expect(apiGet).toHaveBeenCalledWith('/users/me')
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('si falta un camp no envia res i mostra el missatge', async () => {
    const wrapper = await mountEdit()
    await field(wrapper, 'Cognoms').find('input').setValue('  ')

    await submit(wrapper)

    expect(apiPatch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cal omplir tots els camps obligatoris.')
  })

  it("mostra l'error del servidor i conserva el que s'ha escrit", async () => {
    apiPatch.mockRejectedValue(
      new ApiError(403, 'Les dades verificades per KYC no es poden modificar directament.'),
    )
    const wrapper = await mountEdit()
    await field(wrapper, 'Població').find('input').setValue('Girona')

    await submit(wrapper)

    expect(wrapper.text()).toContain('Les dades verificades per KYC no es poden modificar directament.')
    expect(field(wrapper, 'Població').find('input').element.value).toBe('Girona')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it("sense el pas de l'onboarding completat mostra el missatge del backend (409)", async () => {
    apiPatch.mockRejectedValue(new ApiError(409, "Cal completar les dades personals de l'onboarding"))
    const wrapper = await mountEdit()

    await submit(wrapper)

    expect(wrapper.text()).toContain("Cal completar les dades personals de l'onboarding")
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it("si Pydantic rebutja el cos (422 sense text), mostra l'error general", async () => {
    // api.js converteix el detail en llista de Pydantic a 'Error del servidor'
    apiPatch.mockRejectedValue(new ApiError(422, 'Error del servidor'))
    const wrapper = await mountEdit()

    await submit(wrapper)

    expect(wrapper.text()).toContain("No s'han pogut desar les dades. Torna-ho a provar.")
    expect(wrapper.text()).not.toContain('Error del servidor')
  })

  it("si el backend falla, mostra l'error general", async () => {
    apiPatch.mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const wrapper = await mountEdit()

    await submit(wrapper)

    expect(wrapper.text()).toContain("No s'han pogut desar les dades. Torna-ho a provar.")
  })

  it('"Cancel·la" avisa sense enviar res', async () => {
    const wrapper = await mountEdit()

    await wrapper.findAll('button').find((b) => b.text() === 'Cancel·la').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(apiPatch).not.toHaveBeenCalled()
  })
})
