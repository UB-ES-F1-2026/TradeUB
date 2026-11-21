<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { ApiError } from '../services/api'
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
  PIN_CHECK_FAILED_ERROR,
  PIN_FORMAT_ERROR,
  PIN_INCORRECT_ERROR,
  PIN_NOT_CONFIGURED_ERROR,
  WITHDRAWAL_FAILED_ERROR,
  WITHDRAWAL_FORMAT_ERROR,
  WITHDRAWAL_MIN_ERROR,
  isValidIban,
  isValidPin,
  normalizeIban,
  pinErrorMessage,
  withdrawalError,
} from '../utils/withdrawal'

// Targeta "Retirar diners" (US3.3): primer cal vincular un IBAN de prova i després es retira l'import confirmant
// amb el PIN de seguretat. Les validacions d'aquí són per avisar abans; les definitives les fa el backend
const account = useAccountStore()
const router = useRouter()

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

onMounted(async () => {
  try {
    await account.loadIban()
    ibanStatus.value = 'ready'
  } catch {
    ibanStatus.value = 'error'
  }
})

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
}

// --- PIN -----------------------------------------------------------------------------------------------------
// shortcut: pas del PIN dins la targeta fins que hi hagi el PinDialog (issue 130). Quan existeixi, "Continua" l'ha
// d'obrir amb el títol i el resum, i confirmPin és el que ha de fer quan el diàleg retorni el PIN
const step = ref('amount') // amount | pin
const pin = ref('')
const pinSubmitted = ref(false)
const pinError = ref('')
const pinAlert = ref('')
const pinMissing = ref(false)
const withdrawing = ref(false)

const pinFieldError = computed(() => {
  if (pinError.value) return pinError.value
  return pinSubmitted.value && !isValidPin(pin.value) ? PIN_FORMAT_ERROR : ''
})

function resetPinStep() {
  pin.value = ''
  pinSubmitted.value = false
  pinError.value = ''
  pinAlert.value = ''
  pinMissing.value = false
}

function continueToPin() {
  submitted.value = true
  clearAmountMessages()
  if (amountError.value) return
  resetPinStep()
  step.value = 'pin'
}

// Cancel·lar no executa res i el formulari conserva l'import
function cancelPin() {
  step.value = 'amount'
  resetPinStep()
}

function clearPinMessages() {
  pinError.value = ''
  pinAlert.value = ''
}

// Els errors que no són del PIN tanquen el pas del PIN i es mostren a la targeta
function showWithdrawalError(e) {
  step.value = 'amount'
  resetPinStep()
  const message = e instanceof ApiError ? e.message : ''
  if (message === WITHDRAWAL_MIN_ERROR || message.startsWith(INSUFFICIENT_BALANCE_PREFIX)) {
    amountServerError.value = message
  } else if (message === NO_IBAN_ERROR) {
    // La targeta creia que hi havia IBAN: es torna a llegir perquè el demani
    serverError.value = message
    account.loadIban().catch(() => {})
  } else if (e instanceof ApiError && e.status === 422) {
    amountServerError.value = WITHDRAWAL_FORMAT_ERROR
  } else if (e instanceof ApiError && e.status === 403) {
    serverError.value = message
  } else {
    serverError.value = WITHDRAWAL_FAILED_ERROR
  }
}

async function confirmPin() {
  pinSubmitted.value = true
  clearPinMessages()
  if (pinFieldError.value) return

  withdrawing.value = true
  try {
    await account.withdraw(parseAmount(amount.value), pin.value)
    // El saldo ja s'ha actualitzat al store; el moviment es veurà a l'historial (US3.5)
    step.value = 'amount'
    resetPinStep()
    amount.value = ''
    submitted.value = false
  } catch (e) {
    const pinMessage = e instanceof ApiError ? pinErrorMessage(e.status, e.message) : ''
    if (pinMessage === PIN_INCORRECT_ERROR) {
      // El pas es queda obert i el camp es buida
      pinError.value = pinMessage
      pin.value = ''
      pinSubmitted.value = false
    } else if (pinMessage === PIN_NOT_CONFIGURED_ERROR) {
      pinMissing.value = true
    } else if (pinMessage === PIN_CHECK_FAILED_ERROR) {
      pinAlert.value = pinMessage
    } else {
      showWithdrawalError(e)
    }
  } finally {
    withdrawing.value = false
  }
}

function goToProfile() {
  router.push({ name: 'perfil' })
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

    <p
      v-if="ibanStatus === 'loading'"
      class="withdrawal__muted"
    >
      Carregant el compte bancari…
    </p>

    <UiAlert
      v-else-if="ibanStatus === 'error'"
      variant="error"
    >
      {{ IBAN_LOAD_ERROR }}
    </UiAlert>

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
          :disabled="withdrawing"
          data-test="withdrawal-change-iban"
          @click="startChangeIban"
        >
          Canvia
        </UiButton>
      </div>

      <form
        v-if="step === 'amount'"
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

      <form
        v-else
        class="withdrawal__form"
        novalidate
        data-test="withdrawal-pin-step"
        @submit.prevent="confirmPin"
      >
        <div>
          <p class="withdrawal__title">
            Confirma la retirada
          </p>
          <p class="withdrawal__muted">
            <span class="tabular">{{ formattedAmount }}</span> a
            <span class="tabular">{{ account.ibanMasked }}</span>
          </p>
        </div>

        <template v-if="pinMissing">
          <UiAlert
            variant="warning"
            data-test="withdrawal-pin-missing"
          >
            {{ PIN_NOT_CONFIGURED_ERROR }}
          </UiAlert>
          <div class="withdrawal__actions">
            <UiButton
              variant="secondary"
              data-test="withdrawal-go-profile"
              @click="goToProfile"
            >
              Ves al perfil
            </UiButton>
            <UiButton
              variant="ghost"
              @click="cancelPin"
            >
              Cancel·la
            </UiButton>
          </div>
        </template>

        <template v-else>
          <UiAlert
            v-if="pinAlert"
            variant="error"
          >
            {{ pinAlert }}
          </UiAlert>
          <UiInput
            v-model="pin"
            label="PIN de seguretat"
            type="password"
            inputmode="numeric"
            maxlength="4"
            :error="pinFieldError"
            data-test="withdrawal-pin"
            @update:model-value="clearPinMessages"
          />
          <div class="withdrawal__actions">
            <UiButton
              type="submit"
              :loading="withdrawing"
            >
              Confirma
            </UiButton>
            <UiButton
              variant="ghost"
              :disabled="withdrawing"
              data-test="withdrawal-pin-cancel"
              @click="cancelPin"
            >
              Cancel·la
            </UiButton>
          </div>
        </template>
      </form>
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
.withdrawal__title {
  font-weight: 600;
  color: var(--tub-text);
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
