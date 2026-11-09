<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BalanceCard from '../components/BalanceCard.vue'
import { UiAlert, UiButton, UiCard } from '../components/ui'
import { useVerificationStore } from '../stores/verification'

// L'operativa (de moment, el saldo) només es mostra amb la identitat verificada i els termes acceptats (US2.4).
// L'estat ve del backend (GET /users/me), que també el comprova als endpoints operatius
const router = useRouter()
const verification = useVerificationStore()

// Fins que no s'ha comprovat l'estat en aquesta visita no es mostra ni el saldo ni l'avís
const checked = ref(false)

onMounted(async () => {
  await verification.load()
  checked.value = true
})
</script>

<template>
  <section class="page">
    <h1>Actius</h1>

    <p
      v-if="!checked || verification.loading"
      class="page__muted"
    >
      Comprovant l'estat del compte…
    </p>

    <UiAlert
      v-else-if="verification.error"
      variant="error"
    >
      {{ verification.error }}
    </UiAlert>

    <BalanceCard v-else-if="verification.canOperate" />

    <UiCard
      v-else
      class="page__notice"
      data-test="verification-required"
    >
      <p class="eyebrow">
        Compte no verificat
      </p>
      <p>
        Verifica la teva identitat i accepta els termes i condicions per accedir al saldo del compte.
      </p>
      <div>
        <UiButton @click="router.push({ name: 'onboarding' })">
          Verifica't
        </UiButton>
      </div>
    </UiCard>
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--tub-space-5);
  max-width: 720px;
  padding: var(--tub-space-6) var(--tub-space-5);
}
.page__muted {
  color: var(--tub-text-muted);
}
.page__notice {
  display: grid;
  gap: var(--tub-space-3);
}

@media (max-width: 900px) {
  .page {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
}
</style>
