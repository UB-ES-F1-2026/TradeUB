<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAccountStore } from '../stores/account'
import { ApiError } from '../services/api'
import PinDialog from './PinDialog.vue'
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

const format = (amount) => formatCurrency(amount, account.currency)
const unitsText = (units) => (units === 1 ? '1 unitat' : `${units} unitats`)

// El saldo pot no estar carregat si l'usuari no ha passat per Compte d'efectiu
onMounted(() => {
  if (!account.hasBalance) account.fetchBalance()
})

// Avís a dalt de la targeta: error de base de dades, actiu inexistent o usuari sense permís
const serverError = ref('')

// --- Unitats i revisió del cost ------------------------------------------------------------------------------
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

// --- PIN -----------------------------------------------------------------------------------------------------
// "Continua" obre el diàleg del PIN (PinDialog, issue 130) amb el resum de la compra, com a la retirada. Els errors
// del PIN els resol el diàleg; la resta els rep showBuyError
const pinOpen = ref(false)

function continueToPin() {
  submitted.value = true
  clearUnitsMessages()
  if (unitsFieldError.value || insufficientMessage.value) return
  pinOpen.value = true
}

// Cancel·lar no executa res i el formulari conserva les unitats
function cancelPin() {
  pinOpen.value = false
}

// El diàleg la crida amb el PIN escrit
const buy = (pin) => account.buy(props.asset.id, units.value, pin)

// El saldo nou i la posició ja són al store. La targeta es tanca sense missatge d'èxit
function onBought() {
  pinOpen.value = false
  emit('close')
}

// Els errors que no són del PIN tanquen el diàleg i es mostren a la targeta
function showBuyError(e) {
  pinOpen.value = false
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

    <PinDialog
      :open="pinOpen"
      title="Confirma la compra"
      :confirm="buy"
      @cancel="cancelPin"
      @done="onBought"
      @error="showBuyError"
    >
      <template v-if="quote">
        {{ unitsText(units) }} de {{ asset.ticker }} per
        <span class="tabular">{{ format(quote.total) }}</span>
      </template>
    </PinDialog>
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
.buy__name {
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
