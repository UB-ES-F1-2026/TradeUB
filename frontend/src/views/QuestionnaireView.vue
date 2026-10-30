<script setup>
import { INVESTOR_QUESTIONS } from '../utils/investorQuestions'
import { UiCard, UiLogo } from '../components/ui'
import InvestorQuestionnaire from '../components/InvestorQuestionnaire.vue'
</script>

<template>
  <div class="questionnaire-page">
    <div class="questionnaire-page__content">
      <UiLogo class="questionnaire-page__logo" />

      <UiCard>
        <header class="questionnaire-page__head">
          <span class="eyebrow">Perfil d'inversor</span>
          <h1 class="questionnaire-page__title">
            Qüestionari d'experiència inversora
          </h1>
          <p class="questionnaire-page__subtitle">
            Respon aquestes 5 preguntes perquè puguem conèixer el teu perfil com a inversor.
          </p>
        </header>

        <InvestorQuestionnaire :questions="INVESTOR_QUESTIONS" />
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

@media (max-width: 900px) {
  .questionnaire-page {
    padding: var(--tub-space-6) var(--tub-space-4);
  }
}
</style>
