<script setup>
import { useRouter } from 'vue-router'
import { UiButton, UiCard } from './ui'

// Avís per a l'usuari que encara no pot operar (US2.4): porta a l'onboarding per verificar-se.
// Cada pantalla explica a què no té accés
defineProps({
  message: { type: String, required: true },
})

const router = useRouter()
</script>

<template>
  <UiCard
    class="verification-required"
    data-test="verification-required"
  >
    <p class="eyebrow">
      Compte no verificat
    </p>
    <p>{{ message }}</p>
    <div>
      <UiButton @click="router.push({ name: 'onboarding' })">
        Verifica't
      </UiButton>
    </div>
  </UiCard>
</template>

<style scoped>
.verification-required {
  display: grid;
  gap: var(--tub-space-3);
}
</style>
