<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOnboardingStore } from '../stores/onboarding'
import { useInvestorProfileStore } from '../stores/investorProfile'
import { INVESTOR_QUESTIONS } from '../utils/investorQuestions'
import { UiAlert, UiButton, UiCard } from '../components/ui'
import InvestorQuestionnaire from '../components/InvestorQuestionnaire.vue'

// Contenidor de cada pas: el qüestionari (US2.3) ja hi és; els formularis de US2.2 i US2.4 encara no
const onboarding = useOnboardingStore()
const investorProfile = useInvestorProfileStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')

const step = computed(() => onboarding.getStep(route.params.step))
const position = computed(() => onboarding.steps.indexOf(step.value) + 1)
const isQuestionnaire = computed(() => step.value?.id === 'questionari-inversor')

// Desa el pas i salta automàticament al següent pas pendent (o torna a la benvinguda si ja no en queda cap).
// Al pas del qüestionari primer es calcula i desa el perfil amb les respostes
async function complete(answers) {
  error.value = ''
  loading.value = true
  try {
    if (answers) await investorProfile.submitAnswers(answers)
    await onboarding.completeStep(step.value.id)
    await router.push(onboarding.nextStep?.route ?? { name: 'onboarding' })
  } catch {
    error.value = "No s'ha pogut desar el pas. Torna-ho a provar."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="onboarding-step">
    <UiCard
      v-if="step"
      class="onboarding-step__card"
    >
      <span class="eyebrow">Pas {{ position }} de {{ onboarding.steps.length }}</span>
      <h1 class="onboarding-step__title">
        {{ step.title }}
      </h1>
      <p class="onboarding-step__text">
        {{ step.description }}
      </p>

      <UiAlert
        v-if="error"
        variant="error"
      >
        {{ error }}
      </UiAlert>

      <InvestorQuestionnaire
        v-if="isQuestionnaire"
        :questions="INVESTOR_QUESTIONS"
        :loading="loading"
        @submit="complete"
      />

      <div class="onboarding-step__actions">
        <UiButton
          variant="secondary"
          @click="router.push({ name: 'onboarding' })"
        >
          Torna
        </UiButton>
        <UiButton
          v-if="!isQuestionnaire"
          :loading="loading"
          @click="complete()"
        >
          Completa el pas
        </UiButton>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.onboarding-step {
  display: flex;
  min-height: 100vh;
  padding: var(--tub-space-7) var(--tub-space-5);
  background: var(--tub-bg);
}
.onboarding-step__card {
  display: grid;
  gap: var(--tub-space-3);
  max-width: 560px;
  margin: auto;
}
.onboarding-step__title {
  font-size: var(--tub-text-xl);
}
.onboarding-step__text {
  color: var(--tub-text-muted);
}
.onboarding-step__actions {
  display: flex;
  justify-content: space-between;
  gap: var(--tub-space-3);
  margin-top: var(--tub-space-3);
}

@media (max-width: 900px) {
  .onboarding-step {
    padding: var(--tub-space-6) var(--tub-space-4);
  }
}
</style>
