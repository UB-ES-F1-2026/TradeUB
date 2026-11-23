<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { ApiError } from '../services/api'
import { UiAlert, UiBadge, UiButton, UiCard, UiInput } from './ui'
import { assetTypeLabel } from '../utils/assets'
import { formatCurrency } from '../utils/currency'
import {
  BUY_FAILED_ERROR,
  BUY_INSUFFICIENT_BALANCE_ERROR,
  UNITS_FORMAT_ERROR,
  buyQuote,
  parseUnits,
  unitsError,
} from '../utils/buy'
import {
  PIN_CHECK_FAILED_ERROR,
  PIN_FORMAT_ERROR,
  PIN_INCORRECT_ERROR,
  PIN_LENGTH,
  PIN_NOT_CONFIGURED_ERROR,
  isValidPin,
  pinErrorMessage,
} from '../utils/pin'
import { insufficientBalanceError } from '../utils/withdrawal'

// Targeta "Comprar" (US6.1): s'obre des d'un resultat de la cerca. L'usuari tria les unitats, veu el cost, la
// comissió, el total i el saldo que li quedarà, i confirma amb el PIN. El càlcul d'aquí és només la revisió: el
// cobrament el fa el backend amb el preu del catàleg. Si la compra va bé, la targeta es tanca sense missatge d'èxit
const props = defineProps({
  // Actiu de GET /assets: id, name, ticker, type i close_price_eur
  asset: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const account = useAccountStore()
const router = useRouter()

const format = (amount) => formatCurrency(amount, account.currency)
const unitsText = (units) => (units === 1 ? '1 unitat' : `${units} unitats`)

// El saldo pot no estar carregat si l'usuari no ha passat per Compte d'efectiu
onMounted(() => {
  if (!account.hasBalance) account.fetchBalance()
})

// Avís a dalt de la targeta: error de base de dades, actiu inexistent o usuari sense permís
const serverError = ref('')

// --- Unitats i revisió del cost ------------------------------------------------------------------------------
const step = ref('units') // units | pin
const unitsInput = ref('')
const submitted = ref(false)
const unitsServerError = ref('')

const units = computed(() => parseUnits(unitsInput.value))

const unitsFieldError = computed(() => {
  if (unitsServerError.value) return unitsServerError.value
  return submitted.value ? unitsError(unitsInput.value) : ''
})

// Amb unitats vàlides es mostra la revisió. Amb el saldo desconegut no es bloqueja: ho comprova el backend
const quote = computed(() => {
  if (units.value === null) return null
  return buyQuote(units.value, props.asset.close_price_eur, account.hasBalance ? account.balance : null)
})

const insufficientMessage = computed(() => {
  if (!quote.value || quote.value.enough) return ''
  return insufficientBalanceError(quote.value.missing, account.currency)
})

function clearUnitsMessages() {
  unitsServerError.value = ''
  serverError.value = ''
}

function continueToPin() {
  submitted.value = true
  clearUnitsMessages()
  if (unitsFieldError.value || insufficientMessage.value) return
  resetPinStep()
  step.value = 'pin'
}

// --- PIN -----------------------------------------------------------------------------------------------------
// shortcut: pas del PIN dins la targeta, com a la retirada, fins que hi hagi el PinDialog (issue 130). Quan
// existeixi, "Continua" l'ha d'obrir amb el títol i el resum, i confirmPin és el que ha de fer amb el PIN
const pin = ref('')
const pinSubmitted = ref(false)
const pinError = ref('')
const pinAlert = ref('')
const pinMissing = ref(false)
const buying = ref(false)

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

// Cancel·lar no executa res i el formulari conserva les unitats
function cancelPin() {
  step.value = 'units'
  resetPinStep()
}

function clearPinMessages() {
  pinError.value = ''
  pinAlert.value = ''
}

// Els errors que no són del PIN tanquen el pas del PIN i es mostren a la targeta
function showBuyError(e) {
  step.value = 'units'
  resetPinStep()
  const message = e instanceof ApiError ? e.message : ''
  if (message === BUY_INSUFFICIENT_BALANCE_ERROR) {
    // El saldo ha canviat des d'una altra pestanya: es torna a llegir perquè la revisió mostri el que falta
    serverError.value = message
    account.fetchBalance()
  } else if (e instanceof ApiError && e.status === 422) {
    unitsServerError.value = UNITS_FORMAT_ERROR
  } else if (e instanceof ApiError && [403, 404].includes(e.status)) {
    serverError.value = message
  } else {
    serverError.value = BUY_FAILED_ERROR
  }
}

async function confirmPin() {
  pinSubmitted.value = true
  clearPinMessages()
  if (pinFieldError.value) return

  buying.value = true
  try {
    await account.buy(props.asset.id, units.value, pin.value)
    // El saldo nou ja és al store; la posició es veurà a Cartera. La targeta es tanca
    emit('close')
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
      showBuyError(e)
    }
  } finally {
    buying.value = false
  }
}

function goToProfile() {
  router.push({ name: 'perfil' })
}
</script>

<template>
  <UiCard
    class="buy"
    data-test="buy-card"
  >
    <div class="buy__header">
      <div class="buy__asset">
        <p class="eyebrow">
          Comprar
        </p>
        <p class="buy__name">
          {{ asset.name }}
        </p>
        <p class="buy__muted tabular">
          {{ asset.ticker }} · {{ format(Number(asset.close_price_eur)) }} per unitat
        </p>
      </div>
      <UiBadge>{{ assetTypeLabel(asset.type) }}</UiBadge>
    </div>

    <UiAlert
      v-if="serverError"
      variant="error"
      data-test="buy-error"
    >
      {{ serverError }}
    </UiAlert>

    <form
      v-if="step === 'units'"
      class="buy__form"
      novalidate
      data-test="buy-units-form"
      @submit.prevent="continueToPin"
    >
      <UiInput
        v-model="unitsInput"
        label="Unitats"
        inputmode="numeric"
        placeholder="0"
        hint="Només unitats enteres."
        :error="unitsFieldError"
        data-test="buy-units"
        @update:model-value="clearUnitsMessages"
      />

      <dl
        v-if="quote"
        class="buy__summary"
        aria-live="polite"
        data-test="buy-summary"
      >
        <div class="buy__row">
          <dt>Cost ({{ unitsText(units) }})</dt>
          <dd
            class="tabular"
            data-test="buy-cost"
          >
            {{ format(quote.cost) }}
          </dd>
        </div>
        <div class="buy__row">
          <dt>Comissió</dt>
          <dd
            class="tabular"
            data-test="buy-commission"
          >
            {{ format(quote.commission) }}
          </dd>
        </div>
        <div class="buy__row buy__row--total">
          <dt>Total</dt>
          <dd
            class="tabular"
            data-test="buy-total"
          >
            {{ format(quote.total) }}
          </dd>
        </div>
        <!-- Sense saldo suficient no hi ha saldo restant: ho explica l'avís de sota -->
        <div
          v-if="quote.remaining !== null && quote.enough"
          class="buy__row"
        >
          <dt>Saldo restant</dt>
          <dd
            class="tabular"
            data-test="buy-remaining"
          >
            {{ format(quote.remaining) }}
          </dd>
        </div>
      </dl>

      <UiAlert
        v-if="insufficientMessage"
        variant="warning"
        data-test="buy-insufficient"
      >
        {{ insufficientMessage }}
      </UiAlert>

      <div class="buy__actions">
        <UiButton
          type="submit"
          :disabled="Boolean(insufficientMessage)"
          data-test="buy-continue"
        >
          Continua
        </UiButton>
        <UiButton
          variant="ghost"
          data-test="buy-cancel"
          @click="emit('close')"
        >
          Cancel·la
        </UiButton>
      </div>
    </form>

    <form
      v-else
      class="buy__form"
      novalidate
      data-test="buy-pin-step"
      @submit.prevent="confirmPin"
    >
      <div>
        <p class="buy__title">
          Confirma la compra
        </p>
        <p class="buy__muted">
          {{ unitsText(units) }} de {{ asset.ticker }} per
          <span class="tabular">{{ format(quote.total) }}</span>
        </p>
      </div>

      <template v-if="pinMissing">
        <UiAlert
          variant="warning"
          data-test="buy-pin-missing"
        >
          {{ PIN_NOT_CONFIGURED_ERROR }}
        </UiAlert>
        <div class="buy__actions">
          <UiButton
            variant="secondary"
            data-test="buy-go-profile"
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
          :maxlength="PIN_LENGTH"
          :error="pinFieldError"
          data-test="buy-pin"
          @update:model-value="clearPinMessages"
        />
        <div class="buy__actions">
          <UiButton
            type="submit"
            :loading="buying"
          >
            Confirma
          </UiButton>
          <UiButton
            variant="ghost"
            :disabled="buying"
            data-test="buy-pin-cancel"
            @click="cancelPin"
          >
            Cancel·la
          </UiButton>
        </div>
      </template>
    </form>
  </UiCard>
</template>

<style scoped>
.buy,
.buy__form {
  display: grid;
  gap: var(--tub-space-4);
}
.buy__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tub-space-4);
}
.buy__asset {
  min-width: 0;
}
.buy__name,
.buy__title {
  font-weight: 600;
  color: var(--tub-text);
  overflow-wrap: anywhere;
}
.buy__muted {
  color: var(--tub-text-muted);
}
.buy__summary {
  display: grid;
  gap: var(--tub-space-2);
  margin: 0;
  padding: var(--tub-space-4);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface-2);
}
.buy__row {
  display: flex;
  justify-content: space-between;
  gap: var(--tub-space-4);
  color: var(--tub-text-2);
}
.buy__row dd {
  margin: 0;
}
.buy__row--total {
  padding-top: var(--tub-space-2);
  border-top: 1px solid var(--tub-border);
  font-weight: 600;
  color: var(--tub-text);
}
.buy__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}
</style>
