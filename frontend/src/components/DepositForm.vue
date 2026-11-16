<script setup>
import { computed, ref } from 'vue'
import { useAccountStore } from '../stores/account'
import { ApiError } from '../services/api'
import { UiAlert, UiButton, UiCard, UiInput } from './ui'
import { formatCurrency } from '../utils/currency'
import {
  DEPOSIT_FAILED_ERROR,
  DEPOSIT_MAX_ERROR,
  DEPOSIT_MIN_ERROR,
  depositError,
  parseAmount,
} from '../utils/deposit'

// Formulari d'ingrés de diners ficticis (US3.2). Valida l'import abans d'enviar-lo, però la validació
// definitiva i l'actualització del saldo les fa el backend
const account = useAccountStore()

const amount = ref('')
const submitted = ref(false)
const loading = ref(false)
const serverError = ref('')
const success = ref('')

// Només es mostra l'error del camp un cop l'usuari ha intentat ingressar
const fieldError = computed(() => (submitted.value ? depositError(amount.value) : ''))

// Quan l'usuari torna a escriure, els missatges de l'ingrés anterior ja no s'hi apliquen
function clearMessages() {
  serverError.value = ''
  success.value = ''
}

// El backend retorna el missatge exacte del 403 i dels límits; qualsevol altre error (500, xarxa) vol dir que
// el saldo no ha canviat
function serverMessage(e) {
  const known = [DEPOSIT_MIN_ERROR, DEPOSIT_MAX_ERROR]
  if (e instanceof ApiError && (e.status === 403 || known.includes(e.message))) return e.message
  return DEPOSIT_FAILED_ERROR
}

async function handleSubmit() {
  submitted.value = true
  clearMessages()
  if (fieldError.value) return

  const value = parseAmount(amount.value)
  loading.value = true
  try {
    await account.deposit(value)
    success.value = `S'han ingressat ${formatCurrency(Number(value), account.currency)} al compte.`
    amount.value = ''
    submitted.value = false
  } catch (e) {
    serverError.value = serverMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UiCard class="deposit">
    <p class="eyebrow">
      Ingressar diners
    </p>
    <form
      class="deposit__form"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <UiInput
        v-model="amount"
        label="Import"
        inputmode="decimal"
        placeholder="0,00"
        hint="Entre 1 € i 10.000 € per operació."
        :error="fieldError"
        data-test="deposit-amount"
        @update:model-value="clearMessages"
      >
        <template #trailing>
          €
        </template>
      </UiInput>

      <UiAlert
        v-if="serverError"
        variant="error"
      >
        {{ serverError }}
      </UiAlert>
      <UiAlert
        v-if="success"
        variant="success"
      >
        {{ success }}
      </UiAlert>

      <UiButton
        type="submit"
        :loading="loading"
      >
        {{ loading ? 'Ingressant…' : 'Ingressar' }}
      </UiButton>
    </form>
  </UiCard>
</template>

<style scoped>
.deposit,
.deposit__form {
  display: grid;
  gap: var(--tub-space-4);
}
</style>
