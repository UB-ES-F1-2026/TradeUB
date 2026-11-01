<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOnboardingStore } from '../stores/onboarding'
import { UiAlert, UiButton, UiCard } from '../components/ui'

// Contenidor provisional de cada pas: el formulari real de cada pas arriba amb les US2.2, US2.3 i US2.4
const onboarding = useOnboardingStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')

const step = computed(() => onboarding.getStep(route.params.step))
const position = computed(() => onboarding.steps.indexOf(step.value) + 1)

// Desa el pas i salta automàticament al següent pas pendent (o torna a la benvinguda si ja no en queda cap)
async function complete() {
  error.value = ''
  loading.value = true
  try {
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

      <div class="onboarding-step__actions">
        <UiButton
          variant="secondary"
          @click="router.push({ name: 'onboarding' })"
        >
          Torna
        </UiButton>
        <UiButton
          :loading="loading"
          @click="complete"
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
