<script setup>
import { onMounted, ref } from 'vue'
import BalanceCard from '../components/BalanceCard.vue'
import DepositForm from '../components/DepositForm.vue'
import VerificationRequired from '../components/VerificationRequired.vue'
import { UiAlert } from '../components/ui'
import { useVerificationStore } from '../stores/verification'

// Els moviments d'efectiu només estan disponibles amb la identitat verificada i els termes acceptats (US2.4).
// El backend també ho comprova a POST /account/deposits
const verification = useVerificationStore()

// Fins que no s'ha comprovat l'estat en aquesta visita no es mostra ni el formulari ni l'avís
const checked = ref(false)

onMounted(async () => {
  await verification.load()
  checked.value = true
})
</script>

<template>
  <section class="page">
    <h1>Compte d'efectiu</h1>

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

    <template v-else-if="verification.canOperate">
      <BalanceCard />
      <DepositForm />
    </template>

    <VerificationRequired
      v-else
      message="Verifica la teva identitat i accepta els termes i condicions per ingressar diners al compte."
    />
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

@media (max-width: 900px) {
  .page {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
}
</style>
