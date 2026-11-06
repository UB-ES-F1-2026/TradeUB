import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('../components/ui/UiLogo.vue', () => ({
  default: { template: '<div />' },
}))
import { INVESTOR_QUESTIONS } from '../utils/investorQuestions'
import InvestorQuestionnaire from '../components/InvestorQuestionnaire.vue'

const mountQuestionnaire = () =>
  mount(InvestorQuestionnaire, { props: { questions: INVESTOR_QUESTIONS } })

// Marca la primera opció de les n primeres preguntes
async function answerFirst(wrapper, n) {
  const questions = wrapper.findAll('[data-test="question"]')
  for (const question of questions.slice(0, n)) {
    await question.find('input[type="radio"]').setValue(true)
  }
}

describe('InvestorQuestionnaire', () => {
  it('mostra les 5 preguntes amb les seves opcions', () => {
    const questions = mountQuestionnaire().findAll('[data-test="question"]')

    expect(questions).toHaveLength(5)
    questions.forEach((question, i) => {
      expect(question.text()).toContain(INVESTOR_QUESTIONS[i].text)
      expect(question.findAll('input[type="radio"]')).toHaveLength(INVESTOR_QUESTIONS[i].options.length)
    })
  })

  it("bloqueja l'enviament fins que totes les preguntes estan respostes", async () => {
    const wrapper = mountQuestionnaire()
    const submit = wrapper.find('button[type="submit"]')

    expect(submit.attributes('disabled')).toBeDefined()
    await answerFirst(wrapper, 4)
    expect(wrapper.find('[data-test="answered-count"]').text()).toBe('4 de 5 respostes')
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('amb totes les preguntes respostes envia les respostes', async () => {
    const wrapper = mountQuestionnaire()

    await answerFirst(wrapper, 5)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('form').trigger('submit')

    const expected = Object.fromEntries(INVESTOR_QUESTIONS.map((q) => [q.id, q.options[0].id]))
    expect(wrapper.emitted('submit')[0][0]).toEqual(expected)
  })

  it('només es pot triar una opció per pregunta', async () => {
    const wrapper = mountQuestionnaire()
    const radios = wrapper.findAll('[data-test="question"]')[0].findAll('input[type="radio"]')

    await radios[0].setValue(true)
    await radios[2].setValue(true)

    expect(radios[0].element.checked).toBe(false)
    expect(radios[2].element.checked).toBe(true)
    expect(wrapper.find('[data-test="answered-count"]').text()).toBe('1 de 5 respostes')
  })
})
