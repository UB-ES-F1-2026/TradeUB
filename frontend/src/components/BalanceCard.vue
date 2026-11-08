<script setup>
import { computed, onMounted } from 'vue'
import { UiAlert, UiCard } from './ui'
import { useAccountStore } from '../stores/account'
import { formatCurrency } from '../utils/currency'

const account = useAccountStore()

// shortcut: encara no hi ha ordres, el reservat és 0; llegir-lo del backend quan existeixin les ordres pendents
const reserved = 0
const available = computed(() => account.balance - reserved)

const format = (amount) => formatCurrency(amount, account.currency)

onMounted(account.fetchBalance)
</script>

<template>
  <UiCard
    class="balance"
    aria-live="polite"
  >
    <p class="eyebrow">
      Saldo del compte
    </p>

    <UiAlert
      v-if="account.error"
      variant="error"
    >
      {{ account.error }}
    </UiAlert>

    <p
      v-if="!account.hasBalance"
      class="balance__muted"
    >
      {{ account.loading ? 'Carregant el saldo…' : '—' }}
    </p>

    <template v-else>
      <p
        class="balance__total tabular"
        data-test="total"
      >
        {{ format(account.balance) }}
      </p>
      <dl class="balance__split">
        <div>
          <dt class="balance__muted">
            Saldo disponible
          </dt>
          <dd
            class="balance__amount tabular"
            data-test="available"
          >
            {{ format(available) }}
          </dd>
        </div>
        <div>
          <dt class="balance__muted">
            Saldo reservat
          </dt>
          <dd
            class="balance__amount tabular"
            data-test="reserved"
          >
            {{ format(reserved) }}
          </dd>
          <dd class="balance__hint">
            En ordres pendents
          </dd>
        </div>
      </dl>
    </template>
  </UiCard>
</template>

<style scoped>
.balance {
  display: grid;
  gap: var(--tub-space-4);
}
.balance__total {
  font-size: var(--tub-text-2xl);
  font-weight: var(--tub-display-weight);
}
.balance__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--tub-space-4);
  padding-top: var(--tub-space-4);
  border-top: 1px solid var(--tub-border);
}
.balance__muted {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}
.balance__amount {
  font-size: var(--tub-text-lg);
  font-weight: 600;
}
.balance__hint {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-xs);
}

@media (max-width: 900px) {
  .balance__total {
    font-size: var(--tub-text-xl);
  }
}
</style>
