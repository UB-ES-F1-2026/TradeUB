<script setup>
import { onMounted, ref } from 'vue'
import BalanceCard from '../components/BalanceCard.vue'
import DepositForm from '../components/DepositForm.vue'
import VerificationRequired from '../components/VerificationRequired.vue'
import WithdrawalForm from '../components/WithdrawalForm.vue'
import { UiAlert, UiPage } from '../components/ui'
import { useVerificationStore } from '../stores/verification'

// Els moviments d'efectiu només estan disponibles amb la identitat verificada i els termes acceptats (US2.4).
// El backend també ho comprova a POST /account/deposits i POST /account/withdrawals
const verification = useVerificationStore()

// Fins que no s'ha comprovat l'estat en aquesta visita no es mostra ni el formulari ni l'avís
const checked = ref(false)

onMounted(async () => {
  await verification.load()
  checked.value = true
})
</script>

<template>
  <UiPage title="Compte d'efectiu">
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
      <div class="page__operations">
        <DepositForm />
        <WithdrawalForm />
      </div>
    </template>

    <VerificationRequired
      v-else
      message="Verifica la teva identitat i accepta els termes i condicions per ingressar o retirar diners del compte."
    />
  </UiPage>
</template>

<style scoped>
.page__operations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--tub-space-5);
  align-items: start;
}
.page__muted {
  color: var(--tub-text-muted);
}

@media (max-width: 900px) {
  .page__operations {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
