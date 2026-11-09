<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOnboardingStore } from '../stores/onboarding'
import { UiAlert, UiButton, UiCard } from '../components/ui'
import DadesPersonalsForm from '../components/DadesPersonalsForm.vue'
import IdentityDocumentUpload from '../components/IdentityDocumentUpload.vue'

// Contenidor de cada pas. Les dades personals (US2.2) tenen formulari i la verificació (US2.4) la pujada del DNI;
// el qüestionari (US2.3) encara és provisional
const onboarding = useOnboardingStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')

const step = computed(() => onboarding.getStep(route.params.step))
const isPersonalData = computed(() => step.value?.id === 'dades-personals')
const isIdentityVerification = computed(() => step.value?.id === 'verificacio-identitat')
const position = computed(() => onboarding.steps.indexOf(step.value) + 1)

// Torna a demanar l'estat al backend i salta al següent pas pendent (o a la benvinguda si ja no en queda cap).
// El pas el completa el backend quan rep les dades del formulari: aquí només es consulta el resultat
async function complete() {
  error.value = ''
  loading.value = true
  try {
    await onboarding.load()
    await router.push(onboarding.nextStep?.route ?? { name: 'onboarding' })
  } catch {
    error.value = "No s'ha pogut comprovar el progrés. Torna-ho a provar."
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
      :class="{ 'onboarding-step__card--form': isPersonalData || isIdentityVerification }"
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

      <DadesPersonalsForm
        v-if="isPersonalData"
        @saved="complete"
      />

      <!-- US2.4: l'acceptació dels termes (#48) va a continuació del DNI i és la que completa el pas -->
      <IdentityDocumentUpload v-else-if="isIdentityVerification" />

      <div
        v-if="!isPersonalData"
        class="onboarding-step__actions"
      >
        <UiButton
          variant="secondary"
          @click="router.push({ name: 'onboarding' })"
        >
          Torna
        </UiButton>
        <UiButton
          v-if="!isIdentityVerification"
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
.onboarding-step__card--form {
  width: 100%;
  max-width: 640px;
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
