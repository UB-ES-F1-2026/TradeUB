<script setup>
import { useOnboardingStore } from '../stores/onboarding'
import { STEP_STATUS } from '../utils/onboarding'
import { UiBadge, UiCard, UiLogo } from '../components/ui'

const onboarding = useOnboardingStore()

const isCompleted = (step) => step.status === STEP_STATUS.COMPLETED
</script>

<template>
  <div class="onboarding">
    <div class="onboarding__content">
      <UiLogo class="onboarding__logo" />

      <UiCard class="onboarding__panel">
        <header class="onboarding__head">
          <span class="eyebrow">Primers passos</span>
          <h1 class="onboarding__title">
            Benvingut a TradeUB
          </h1>
          <p class="onboarding__subtitle">
            Abans de començar a invertir amb diners simulats, completa aquests passos.
          </p>
        </header>

        <ol class="onboarding__steps">
          <li
            v-for="(step, index) in onboarding.steps"
            :key="step.id"
            class="onboarding__step"
            :class="{ 'onboarding__step--done': isCompleted(step) }"
            data-test="step-card"
          >
            <span
              class="onboarding__step-index tabular"
              aria-hidden="true"
            >{{ isCompleted(step) ? '✓' : index + 1 }}</span>
            <div class="onboarding__step-body">
              <h2 class="onboarding__step-title">
                {{ step.title }}
              </h2>
              <p class="onboarding__step-text">
                {{ step.description }}
              </p>
            </div>
            <UiBadge :variant="isCompleted(step) ? 'success' : 'neutral'">
              {{ isCompleted(step) ? 'Completat' : 'Pendent' }}
            </UiBadge>
          </li>
        </ol>
      </UiCard>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  display: flex;
  min-height: 100vh;
  padding: var(--tub-space-7) var(--tub-space-5);
  background: var(--tub-bg);
}
/* margin: auto centra el panell sense tallar-ne la part de dalt si és més alt que la pantalla */
.onboarding__content {
  display: grid;
  gap: var(--tub-space-5);
  width: 100%;
  max-width: 560px;
  margin: auto;
}
.onboarding__logo {
  justify-self: center;
}
.onboarding__panel {
  display: grid;
  gap: var(--tub-space-5);
}

.onboarding__head {
  display: grid;
  gap: var(--tub-space-1);
}
.onboarding__title {
  font-size: var(--tub-text-xl);
}
.onboarding__subtitle {
  color: var(--tub-text-muted);
  line-height: 1.5;
}

/* ---------- Targetes dels passos ---------- */
.onboarding__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--tub-space-3);
}
.onboarding__step {
  display: flex;
  align-items: center;
  gap: var(--tub-space-4);
  padding: var(--tub-space-4);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-lg);
  background: var(--tub-surface);
  transition: border-color var(--tub-duration) var(--tub-ease);
}
.onboarding__step--done {
  border-color: var(--tub-success-border);
  background: var(--tub-green-soft);
}
.onboarding__step-index {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--tub-radius-pill);
  background: var(--tub-primary-soft);
  color: var(--tub-primary-hover);
  font-size: var(--tub-text-sm);
  font-weight: 700;
}
.onboarding__step--done .onboarding__step-index {
  background: var(--tub-green);
  color: var(--tub-primary-contrast);
}
.onboarding__step-body {
  display: grid;
  flex: 1;
  gap: var(--tub-space-1);
  min-width: 0;
}
.onboarding__step-title {
  font-size: var(--tub-text-md);
  letter-spacing: normal;
}
.onboarding__step-text {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
  line-height: 1.45;
}

@media (max-width: 900px) {
  .onboarding {
    padding: var(--tub-space-6) var(--tub-space-4);
  }
  .onboarding__step {
    flex-wrap: wrap;
    gap: var(--tub-space-3);
  }
}
</style>
