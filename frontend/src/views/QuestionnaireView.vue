<script setup>
import { ref } from 'vue'
import { useInvestorProfileStore } from '../stores/investorProfile'
import { INVESTOR_QUESTIONS } from '../utils/investorQuestions'
import { UiAlert, UiBadge, UiButton, UiCard, UiLogo } from '../components/ui'
import InvestorQuestionnaire from '../components/InvestorQuestionnaire.vue'

const investorProfile = useInvestorProfileStore()

const loading = ref(false)
const error = ref('')
// Si ja hi ha un perfil desat es mostra el resultat; es pot tornar a fer el qüestionari
const showResult = ref(investorProfile.hasProfile)

async function handleSubmit(answers) {
  error.value = ''
  loading.value = true
  try {
    await investorProfile.submitAnswers(answers)
    showResult.value = true
  } catch {
    error.value = "No s'ha pogut desar el teu perfil. Torna-ho a provar."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="questionnaire-page">
    <div class="questionnaire-page__content">
      <UiLogo class="questionnaire-page__logo" />

      <UiCard>
        <!-- Resultat: perfil assignat -->
        <section
          v-if="showResult"
          class="questionnaire-page__result"
          data-test="result"
        >
          <span class="eyebrow">Perfil d'inversor</span>
          <h1 class="questionnaire-page__title">
            El teu perfil és
          </h1>
          <UiBadge
            variant="success"
            class="questionnaire-page__profile"
          >
            {{ investorProfile.profileLabel }}
          </UiBadge>
          <p class="questionnaire-page__subtitle">
            L'hem calculat a partir de les teves respostes i l'hem desat al teu compte.
          </p>
          <UiButton
            variant="secondary"
            block
            @click="showResult = false"
          >
            Torna a fer el qüestionari
          </UiButton>
        </section>

        <!-- Qüestionari -->
        <template v-else>
          <header class="questionnaire-page__head">
            <span class="eyebrow">Perfil d'inversor</span>
            <h1 class="questionnaire-page__title">
              Qüestionari d'experiència inversora
            </h1>
            <p class="questionnaire-page__subtitle">
              Respon aquestes 5 preguntes perquè puguem conèixer el teu perfil com a inversor.
            </p>
          </header>

          <UiAlert
            v-if="error"
            variant="error"
            class="questionnaire-page__error"
          >
            {{ error }}
          </UiAlert>

          <InvestorQuestionnaire
            :questions="INVESTOR_QUESTIONS"
            :loading="loading"
            @submit="handleSubmit"
          />
        </template>
      </UiCard>
    </div>
  </div>
</template>

<style scoped>
.questionnaire-page {
  display: flex;
  min-height: 100vh;
  padding: var(--tub-space-7) var(--tub-space-5);
  background: var(--tub-bg);
}
/* margin: auto centra el contingut sense tallar-ne la part de dalt si és més alt que la pantalla */
.questionnaire-page__content {
  display: grid;
  gap: var(--tub-space-5);
  width: 100%;
  max-width: 600px;
  margin: auto;
}
.questionnaire-page__logo {
  justify-self: center;
}
.questionnaire-page__head {
  display: grid;
  gap: var(--tub-space-1);
  margin-bottom: var(--tub-space-6);
}
.questionnaire-page__title {
  font-size: var(--tub-text-xl);
}
.questionnaire-page__subtitle {
  color: var(--tub-text-muted);
  line-height: 1.5;
}
.questionnaire-page__error {
  margin-bottom: var(--tub-space-5);
}

.questionnaire-page__result {
  display: grid;
  justify-items: center;
  gap: var(--tub-space-3);
  text-align: center;
}
.questionnaire-page__profile {
  font-size: var(--tub-text-lg);
}

@media (max-width: 900px) {
  .questionnaire-page {
    padding: var(--tub-space-6) var(--tub-space-4);
  }
}
</style>
