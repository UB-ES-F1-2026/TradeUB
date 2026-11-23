<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAccountStore } from '../stores/account'
import { ApiError } from '../services/api'
import PinDialog from './PinDialog.vue'
import { UiAlert, UiButton, UiCard, UiInput } from './ui'
import { formatCurrency } from '../utils/currency'
import { parseAmount } from '../utils/deposit'
import {
  IBAN_HINT,
  IBAN_INVALID_ERROR,
  IBAN_LOAD_ERROR,
  IBAN_SAVE_FAILED_ERROR,
  INSUFFICIENT_BALANCE_PREFIX,
  NO_IBAN_ERROR,
  WITHDRAWAL_FAILED_ERROR,
  WITHDRAWAL_FORMAT_ERROR,
  WITHDRAWAL_MIN_ERROR,
  isValidIban,
  normalizeIban,
  withdrawalError,
} from '../utils/withdrawal'

// Targeta "Retirar diners" (US3.3): primer cal vincular un IBAN de prova i després es retira l'import confirmant
// amb el PIN de seguretat. Les validacions d'aquí són per avisar abans; les definitives les fa el backend
const account = useAccountStore()

// --- IBAN ---------------------------------------------------------------------------------------------------
const ibanStatus = ref('loading') // loading | error | ready
const changingIban = ref(false)
const ibanText = ref('')
const ibanSubmitted = ref(false)
const ibanSaving = ref(false)
const ibanServerError = ref('')

// Sense IBAN vinculat la targeta només demana l'IBAN; amb IBAN, "Canvia" torna a obrir el mateix formulari
const showIbanForm = computed(() => !account.ibanMasked || changingIban.value)

const ibanError = computed(() => {
  if (ibanServerError.value) return ibanServerError.value
  return ibanSubmitted.value && !isValidIban(ibanText.value) ? IBAN_INVALID_ERROR : ''
})

async function loadIban() {
  ibanStatus.value = 'loading'
  try {
    await account.loadIban()
    ibanStatus.value = 'ready'
  } catch {
    ibanStatus.value = 'error'
  }
}

onMounted(loadIban)

function startChangeIban() {
  changingIban.value = true
  ibanText.value = ''
  ibanSubmitted.value = false
  ibanServerError.value = ''
}

function cancelChangeIban() {
  changingIban.value = false
}

// El backend substitueix directament l'IBAN anterior, sense pas de confirmació
async function submitIban() {
  ibanSubmitted.value = true
  ibanServerError.value = ''
  if (ibanError.value) return

  ibanSaving.value = true
  try {
    await account.linkIban(normalizeIban(ibanText.value))
    serverError.value = ''
    changingIban.value = false
    ibanText.value = ''
    ibanSubmitted.value = false
  } catch (e) {
    const known = e instanceof ApiError && (e.status === 403 || e.message === IBAN_INVALID_ERROR)
    ibanServerError.value = known ? e.message : IBAN_SAVE_FAILED_ERROR
  } finally {
    ibanSaving.value = false
  }
}

// --- Import --------------------------------------------------------------------------------------------------
const amount = ref('')
const submitted = ref(false)
const amountServerError = ref('')
// Avís a dalt de la targeta: error de base de dades o usuari sense permís
const serverError = ref('')
// Confirmació de l'última retirada, com la del formulari d'ingrés
const success = ref('')

// Amb el saldo carregat, el saldo insuficient s'avisa abans d'arribar al PIN
const amountError = computed(() => {
  if (amountServerError.value) return amountServerError.value
  if (!submitted.value) return ''
  return withdrawalError(amount.value, account.hasBalance ? account.balance : null, account.currency)
})

const formattedAmount = computed(() => formatCurrency(Number(parseAmount(amount.value) ?? 0), account.currency))

function clearAmountMessages() {
  amountServerError.value = ''
  serverError.value = ''
  success.value = ''
}

// --- PIN -----------------------------------------------------------------------------------------------------
// "Continua" obre el diàleg del PIN (PinDialog, issue 130) amb el resum de la retirada. Els errors del PIN els resol el
// diàleg; la resta els rep showWithdrawalError
const pinOpen = ref(false)

function continueToPin() {
  submitted.value = true
  clearAmountMessages()
  if (amountError.value) return
  pinOpen.value = true
}

// Cancel·lar no executa res i el formulari conserva l'import
function cancelPin() {
  pinOpen.value = false
}

// El diàleg la crida amb el PIN escrit
const withdraw = (pin) => account.withdraw(parseAmount(amount.value), pin)

// El saldo ja s'ha actualitzat al store; el moviment es veurà a l'historial (US3.5)
function onWithdrawn() {
  pinOpen.value = false
  success.value = `S'han retirat ${formattedAmount.value} del compte.`
  amount.value = ''
  submitted.value = false
}

// Els errors que no són del PIN tanquen el diàleg i es mostren a la targeta
function showWithdrawalError(e) {
  pinOpen.value = false
  const message = e instanceof ApiError ? e.message : ''
  if (message === WITHDRAWAL_MIN_ERROR || message.startsWith(INSUFFICIENT_BALANCE_PREFIX)) {
    amountServerError.value = message
  } else if (message === NO_IBAN_ERROR) {
    // La targeta creia que hi havia IBAN i el backend diu que no: es torna a demanar
    serverError.value = message
    account.ibanMasked = null
  } else if (e instanceof ApiError && e.status === 422) {
    amountServerError.value = WITHDRAWAL_FORMAT_ERROR
  } else if (e instanceof ApiError && e.status === 403) {
    serverError.value = message
  } else {
    serverError.value = WITHDRAWAL_FAILED_ERROR
  }
}
</script>

<template>
  <UiCard class="withdrawal">
    <p class="eyebrow">
      Retirar diners
    </p>

    <UiAlert
      v-if="serverError"
      variant="error"
      data-test="withdrawal-error"
    >
      {{ serverError }}
    </UiAlert>
    <UiAlert
      v-if="success"
      variant="success"
      data-test="withdrawal-success"
    >
      {{ success }}
    </UiAlert>

    <p
      v-if="ibanStatus === 'loading'"
      class="withdrawal__muted"
    >
      Carregant el compte bancari…
    </p>

    <template v-else-if="ibanStatus === 'error'">
      <UiAlert variant="error">
        {{ IBAN_LOAD_ERROR }}
      </UiAlert>
      <div class="withdrawal__actions">
        <UiButton
          variant="secondary"
          data-test="withdrawal-iban-retry"
          @click="loadIban"
        >
          Torna-ho a provar
        </UiButton>
      </div>
    </template>

    <form
      v-else-if="showIbanForm"
      class="withdrawal__form"
      novalidate
      data-test="withdrawal-iban-form"
      @submit.prevent="submitIban"
    >
      <p
        v-if="!account.ibanMasked"
        class="withdrawal__muted"
      >
        Per retirar diners, primer vincula el compte bancari on els vols rebre.
      </p>
      <UiInput
        v-model="ibanText"
        label="IBAN"
        placeholder="ES00 0000 0000 0000 0000 0000"
        :hint="IBAN_HINT"
        :error="ibanError"
        data-test="withdrawal-iban"
        @update:model-value="ibanServerError = ''"
      />
      <div class="withdrawal__actions">
        <UiButton
          type="submit"
          :loading="ibanSaving"
        >
          Vincula l'IBAN
        </UiButton>
        <UiButton
          v-if="account.ibanMasked"
          variant="ghost"
          :disabled="ibanSaving"
          @click="cancelChangeIban"
        >
          Cancel·la
        </UiButton>
      </div>
    </form>

    <template v-else>
      <div class="withdrawal__iban">
        <div>
          <p class="withdrawal__label">
            Compte de destinació
          </p>
          <p
            class="tabular"
            data-test="withdrawal-iban-masked"
          >
            {{ account.ibanMasked }}
          </p>
        </div>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="pinOpen"
          data-test="withdrawal-change-iban"
          @click="startChangeIban"
        >
          Canvia
        </UiButton>
      </div>

      <form
        class="withdrawal__form"
        novalidate
        data-test="withdrawal-amount-form"
        @submit.prevent="continueToPin"
      >
        <UiInput
          v-model="amount"
          label="Import a retirar"
          inputmode="decimal"
          placeholder="0,00"
          hint="Mínim 1 €. Com a màxim, el saldo disponible."
          :error="amountError"
          data-test="withdrawal-amount"
          @update:model-value="clearAmountMessages"
        >
          <template #trailing>
            €
          </template>
        </UiInput>
        <UiButton type="submit">
          Continua
        </UiButton>
      </form>

      <PinDialog
        :open="pinOpen"
        title="Confirma la retirada"
        :confirm="withdraw"
        @cancel="cancelPin"
        @done="onWithdrawn"
        @error="showWithdrawalError"
      >
        <span class="tabular">{{ formattedAmount }}</span> a
        <span class="tabular">{{ account.ibanMasked }}</span>
      </PinDialog>
    </template>
  </UiCard>
</template>

<style scoped>
.withdrawal,
.withdrawal__form {
  display: grid;
  gap: var(--tub-space-4);
}
.withdrawal__muted,
.withdrawal__label {
  color: var(--tub-text-muted);
}
.withdrawal__label {
  font-size: var(--tub-text-sm);
}
.withdrawal__iban {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tub-space-4);
}
.withdrawal__iban .tabular {
  overflow-wrap: anywhere;
}
.withdrawal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}
</style>
