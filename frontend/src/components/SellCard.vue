<script setup>
import { computed, ref } from 'vue'
import { useAccountStore } from '../stores/account'
import { ApiError } from '../services/api'
import PinDialog from './PinDialog.vue'
import { UiAlert, UiBadge, UiButton, UiCard, UiInput } from './ui'
import { assetTypeLabel } from '../utils/assets'
import { UNITS_FORMAT_ERROR, parseUnits } from '../utils/buy'
import { formatCurrency } from '../utils/currency'
import {
  SELL_FAILED_ERROR,
  SELL_INSUFFICIENT_UNITS_ERROR,
  sellQuote,
  sellUnitsError,
} from '../utils/sell'

// Targeta "Vendre" (US6.2): s'obre des d'un resultat de la cerca quan l'usuari té unitats de l'actiu. Tria les unitats
// (com a màxim, les de la posició), veu l'import, la comissió i l'import net que rebrà, i confirma amb el PIN. El càlcul
// d'aquí és només la revisió: l'import el decideix el backend amb el preu del catàleg. Si la venda va bé, la targeta
// es tanca sense missatge d'èxit
const props = defineProps({
  // Actiu de GET /assets: id, name, ticker, type i close_price_eur
  asset: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const account = useAccountStore()

const format = (amount) => formatCurrency(amount, account.currency)
const unitsText = (units) => (units === 1 ? '1 unitat' : `${units} unitats`)

// Unitats de la posició: el màxim que es pot vendre
const held = computed(() => account.unitsHeld(props.asset.id))

// Avís a dalt de la targeta: error de base de dades, actiu inexistent o usuari sense permís
const serverError = ref('')

// --- Unitats i import net ------------------------------------------------------------------------------------
const unitsInput = ref('')
const submitted = ref(false)
const unitsServerError = ref('')

const units = computed(() => parseUnits(unitsInput.value))

// Com a la compra sense saldo, "Continua" queda desactivat mentre es demanen més unitats de les que es tenen
const tooManyUnits = computed(() => units.value !== null && units.value > held.value)

// L'excés d'unitats s'avisa mentre s'escriu; la resta d'errors, en prémer "Continua"
const unitsFieldError = computed(() => {
  if (unitsServerError.value) return unitsServerError.value
  const error = sellUnitsError(unitsInput.value, held.value)
  if (error === SELL_INSUFFICIENT_UNITS_ERROR) return error
  return submitted.value ? error : ''
})

// Amb unitats vàlides que no passen de la posició es mostra la revisió
const quote = computed(() => {
  if (units.value === null || tooManyUnits.value) return null
  return sellQuote(units.value, props.asset.close_price_eur)
})

function clearUnitsMessages() {
  unitsServerError.value = ''
  serverError.value = ''
}

// --- PIN -----------------------------------------------------------------------------------------------------
// "Continua" obre el diàleg del PIN (PinDialog, issue 130) amb el resum de la venda. Els errors del PIN els resol el
// diàleg; la resta els rep showSellError
const pinOpen = ref(false)

function continueToPin() {
  submitted.value = true
  clearUnitsMessages()
  if (unitsFieldError.value) return
  pinOpen.value = true
}

// Cancel·lar no executa res i el formulari conserva les unitats
function cancelPin() {
  pinOpen.value = false
}

// El diàleg la crida amb el PIN escrit
const sell = (pin) => account.sell(props.asset.id, units.value, pin)

// El saldo nou i la posició ja són al store. La targeta es tanca sense missatge d'èxit
function onSold() {
  pinOpen.value = false
  emit('close')
}

// Els errors que no són del PIN tanquen el diàleg i es mostren a la targeta
function showSellError(e) {
  pinOpen.value = false
  const message = e instanceof ApiError ? e.message : ''
  if (message === SELL_INSUFFICIENT_UNITS_ERROR) {
    // La posició ha canviat des d'una altra pestanya: es torna a llegir perquè el màxim sigui el real
    unitsServerError.value = message
    account.fetchPositions().catch(() => {})
  } else if (e instanceof ApiError && e.status === 422) {
    unitsServerError.value = UNITS_FORMAT_ERROR
  } else if (e instanceof ApiError && [403, 404].includes(e.status)) {
    serverError.value = message
  } else {
    serverError.value = SELL_FAILED_ERROR
  }
}
</script>

<template>
  <UiCard
    class="sell"
    data-test="sell-card"
  >
    <div class="sell__header">
      <div class="sell__asset">
        <p class="eyebrow">
          Vendre
        </p>
        <p class="sell__name">
          {{ asset.name }}
        </p>
        <p class="sell__muted tabular">
          {{ asset.ticker }} · {{ format(Number(asset.close_price_eur)) }} per unitat
        </p>
      </div>
      <UiBadge>{{ assetTypeLabel(asset.type) }}</UiBadge>
    </div>

    <UiAlert
      v-if="serverError"
      variant="error"
      data-test="sell-error"
    >
      {{ serverError }}
    </UiAlert>

    <form
      class="sell__form"
      novalidate
      data-test="sell-units-form"
      @submit.prevent="continueToPin"
    >
      <UiInput
        v-model="unitsInput"
        label="Unitats"
        inputmode="numeric"
        placeholder="0"
        :hint="`Tens ${unitsText(held)}. Només unitats enteres.`"
        :error="unitsFieldError"
        data-test="sell-units"
        @update:model-value="clearUnitsMessages"
      />

      <dl
        v-if="quote"
        class="sell__summary"
        aria-live="polite"
        data-test="sell-summary"
      >
        <div class="sell__row">
          <dt>Import ({{ unitsText(units) }})</dt>
          <dd
            class="tabular"
            data-test="sell-amount"
          >
            {{ format(quote.amount) }}
          </dd>
        </div>
        <div class="sell__row">
          <dt>Comissió</dt>
          <!-- Es descompta de l'import: es mostra amb el signe menys tipogràfic -->
          <dd
            class="tabular"
            data-test="sell-commission"
          >
            −{{ format(quote.commission) }}
          </dd>
        </div>
        <div class="sell__row sell__row--total">
          <dt>Import net</dt>
          <dd
            class="tabular"
            data-test="sell-net"
          >
            {{ format(quote.net) }}
          </dd>
        </div>
      </dl>

      <div class="sell__actions">
        <UiButton
          type="submit"
          :disabled="tooManyUnits"
          data-test="sell-continue"
        >
          Continua
        </UiButton>
        <UiButton
          variant="ghost"
          data-test="sell-cancel"
          @click="emit('close')"
        >
          Cancel·la
        </UiButton>
      </div>
    </form>

    <PinDialog
      :open="pinOpen"
      title="Confirma la venda"
      :confirm="sell"
      @cancel="cancelPin"
      @done="onSold"
      @error="showSellError"
    >
      <template v-if="quote">
        {{ unitsText(units) }} de {{ asset.ticker }}. Rebràs
        <span class="tabular">{{ format(quote.net) }}</span>
      </template>
    </PinDialog>
  </UiCard>
</template>

<style scoped>
.sell,
.sell__form {
  display: grid;
  gap: var(--tub-space-4);
}
.sell__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tub-space-4);
}
.sell__asset {
  min-width: 0;
}
.sell__name {
  font-weight: 600;
  color: var(--tub-text);
  overflow-wrap: anywhere;
}
.sell__muted {
  color: var(--tub-text-muted);
}
.sell__summary {
  display: grid;
  gap: var(--tub-space-2);
  margin: 0;
  padding: var(--tub-space-4);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface-2);
}
.sell__row {
  display: flex;
  justify-content: space-between;
  gap: var(--tub-space-4);
  color: var(--tub-text-2);
}
.sell__row dd {
  margin: 0;
}
.sell__row--total {
  padding-top: var(--tub-space-2);
  border-top: 1px solid var(--tub-border);
  font-weight: 600;
  color: var(--tub-text);
}
.sell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}
</style>
