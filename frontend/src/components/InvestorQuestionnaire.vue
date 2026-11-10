<script setup>
import { computed, reactive } from 'vue'
import { UiButton, UiRadioGroup } from './ui'

const props = defineProps({
  questions: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})

// submit: { [idPregunta]: idOpció } amb totes les preguntes respostes
const emit = defineEmits(['submit'])

const answers = reactive({})

const answeredCount = computed(() => props.questions.filter((q) => answers[q.id]).length)
const allAnswered = computed(() => answeredCount.value === props.questions.length)

function handleSubmit() {
  // L'enviament queda bloquejat fins que totes les preguntes tenen resposta
  if (!allAnswered.value) return
  emit('submit', { ...answers })
}
</script>

<template>
  <form
    class="questionnaire"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <fieldset
      v-for="(question, index) in questions"
      :key="question.id"
      class="questionnaire__question"
      data-test="question"
    >
      <legend class="questionnaire__text">
        <span class="questionnaire__index tabular">{{ index + 1 }}</span>
        {{ question.text }}
      </legend>

      <UiRadioGroup
        v-model="answers[question.id]"
        :name="question.id"
        :options="question.options"
      />
    </fieldset>

    <div class="questionnaire__footer">
      <p
        class="questionnaire__count tabular"
        aria-live="polite"
        data-test="answered-count"
      >
        {{ answeredCount }} de {{ questions.length }} respostes
      </p>
      <UiButton
        type="submit"
        size="lg"
        block
        :disabled="!allAnswered"
        :loading="loading"
      >
        Envia les respostes
      </UiButton>
    </div>
  </form>
</template>

<style scoped>
.questionnaire {
  display: grid;
  gap: var(--tub-space-5);
}

.questionnaire__question {
  display: grid;
  gap: var(--tub-space-3);
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.questionnaire__text {
  display: flex;
  align-items: flex-start;
  gap: var(--tub-space-2);
  margin-bottom: var(--tub-space-3);
  padding: 0;
  font-weight: 600;
  color: var(--tub-text);
}
.questionnaire__index {
  display: grid;
  flex: none;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--tub-radius-pill);
  background: var(--tub-primary-soft);
  color: var(--tub-primary-hover);
  font-size: var(--tub-text-xs);
  font-weight: 700;
}

.questionnaire__footer {
  display: grid;
  gap: var(--tub-space-2);
}
.questionnaire__count {
  text-align: center;
  font-size: var(--tub-text-sm);
  color: var(--tub-text-muted);
}
</style>
