<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOnboardingStore } from '../stores/onboarding'
import { useProfileStore } from '../stores/profile'
import { UiAlert, UiBadge, UiButton, UiCard } from '../components/ui'
import DadesPersonalsForm from '../components/DadesPersonalsForm.vue'
import InvestorQuestionnaire from '../components/InvestorQuestionnaire.vue'
import IdentityDocumentUpload from '../components/IdentityDocumentUpload.vue'
import { INVESTOR_QUESTIONS, PROFILE_LABELS } from '../utils/investorQuestions'

// Contenidor de cada pas. Cada un té el seu component: formulari de dades personals (US2.2),
// qüestionari (US2.3) i pujada del DNI (US2.4)
const onboarding = useOnboardingStore()
const profile = useProfileStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
// Perfil que ha retornat el backend en enviar el qüestionari; es mostra abans de continuar
const investorProfile = ref('')

const step = computed(() => onboarding.getStep(route.params.step))
const isPersonalData = computed(() => step.value?.id === 'dades-personals')
const isQuestionnaire = computed(() => step.value?.id === 'questionari-inversor')
const isIdentityVerification = computed(() => step.value?.id === 'verificacio-identitat')
const position = computed(() => onboarding.steps.indexOf(step.value) + 1)

// El backend calcula i desa el perfil amb les respostes; aquí només es mostra el resultat
async function submitQuestionnaire(answers) {
  error.value = ''
  loading.value = true
  try {
    investorProfile.value = await profile.saveInvestorQuestionnaire(answers)
  } catch {
    error.value = "No s'ha pogut desar el teu perfil. Torna-ho a provar."
  } finally {
    loading.value = false
  }
}

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
      :class="{ 'onboarding-step__card--form': isPersonalData || isQuestionnaire || isIdentityVerification }"
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

      <template v-else-if="isQuestionnaire">
        <section
          v-if="investorProfile"
          class="onboarding-step__result"
          data-test="result"
        >
          <span class="eyebrow">El teu perfil és</span>
          <UiBadge
            variant="success"
            class="onboarding-step__profile"
          >
            {{ PROFILE_LABELS[investorProfile] ?? investorProfile }}
          </UiBadge>
          <UiButton
            block
            :loading="loading"
            @click="complete"
          >
            Continua
          </UiButton>
        </section>
        <InvestorQuestionnaire
          v-else
          :questions="INVESTOR_QUESTIONS"
          :loading="loading"
          @submit="submitQuestionnaire"
        />
      </template>

      <!-- US2.4: l'acceptació dels termes (#48) va a continuació del DNI i és la que completa el pas -->
      <IdentityDocumentUpload v-else-if="isIdentityVerification" />

      <!-- Cada pas es completa des del seu component; ja no queda cap pas amb el botó provisional "Completa el pas" -->
      <div
        v-if="isIdentityVerification"
        class="onboarding-step__actions"
      >
        <UiButton
          variant="secondary"
          @click="router.push({ name: 'onboarding' })"
        >
          Torna
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
.onboarding-step__result {
  display: grid;
  justify-items: center;
  gap: var(--tub-space-3);
  text-align: center;
}
.onboarding-step__profile {
  font-size: var(--tub-text-lg);
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
