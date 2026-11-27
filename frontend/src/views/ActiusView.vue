<script setup>
import { onMounted, ref } from 'vue'
import AssetSearch from '../components/AssetSearch.vue'
import BuyCard from '../components/BuyCard.vue'
import MarketFeed from '../components/MarketFeed.vue'
import SellCard from '../components/SellCard.vue'
import { UiBadge, UiPage } from '../components/ui'
import { apiGet } from '../services/api'
import { NO_NOTES, marketNotes } from '../utils/marketNotes'
import { useAccountStore } from '../stores/account'
import { useVerificationStore } from '../stores/verification'

// Actius té el cercador (US5.1), la compra (US6.1) i la venda (US6.2). El saldo és a Compte d'efectiu (US3.2), i
// cercar no és operar: el cercador surt a tots els usuaris registrats, encara que no estiguin verificats. Només qui
// pot operar (identitat verificada i termes acceptats) pot comprar o vendre; el backend també ho comprova
const verification = useVerificationStore()
const account = useAccountStore()

// Operació oberta: { type: 'buy' | 'sell', asset }. Només n'hi ha una alhora; la targeta es tanca en cancel·lar o
// quan l'operació ha anat bé
const operation = ref(null)

// Text del cercador. És aquí perquè l'actualitat del mercat (US17.1) hi pugui posar el ticker d'un avís
const searchQuery = ref('')

// Actualitat del mercat (US17.1): avisos de preu del catàleg sencer, no de la llista filtrada pel cercador (si no, en
// prémer un avís canviarien els avisos). null mentre es carrega o si falla: llavors la secció no surt
const notes = ref(null)

// Es tornen a calcular cada vegada que la cinta comença una volta (C3), amb la variació que retorna l'API en aquell
// moment: el text d'una targeta no canvia mai mentre es llegeix. Si una recàrrega falla, es queden els que hi havia
async function loadNotes() {
  try {
    const assets = await apiGet('/assets')
    notes.value = marketNotes(Array.isArray(assets) ? assets : [])
  } catch {
    // Sense catàleg no hi ha avisos; el cercador ja mostra el seu error
  }
}

// En prémer un avís, el cercador s'omple amb el ticker i la llista en mostra el resultat (C6)
function showAsset(ticker) {
  searchQuery.value = ticker
}

// La verificació es llegeix sense bloquejar el cercador. Fins que arriba (o si falla) no es pot triar cap actiu.
// Les posicions diuen quins actius es poden vendre; si no es poden llegir, només no surt "Ven"
onMounted(async () => {
  loadNotes()
  await verification.load()
  if (verification.canOperate) account.fetchPositions().catch(() => {})
})

// La targeta va a dalt, sota el títol: si l'usuari havia baixat per la llista, es torna a dalt de la pàgina.
// Si ja hi és, no es mou res
function open(type, asset) {
  operation.value = { type, asset }
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function close() {
  operation.value = null
}
</script>

<template>
  <UiPage title="Actius">
    <!-- El catàleg és simulat: els preus no són de mercat (US5.3) -->
    <template #actions>
      <UiBadge data-test="simulated-prices">
        Preus simulats
      </UiBadge>
    </template>

    <MarketFeed
      v-if="notes"
      :items="notes"
      label="Actualitat del mercat"
      data-test="market-feed"
      @loop="loadNotes"
    >
      <template #item="{ item }">
        <button
          type="button"
          class="note"
          data-test="market-note"
          @click="showAsset(item.ticker)"
        >
          <UiBadge :variant="item.trend === 'up' ? 'success' : 'danger'">
            {{ item.ticker }}
          </UiBadge>
          <span
            class="note__icon"
            :class="`note__icon--${item.trend}`"
            aria-hidden="true"
          >
            {{ item.trend === 'up' ? '↑' : '↓' }}
          </span>
          <strong class="note__text">{{ item.text }}</strong>
          <span class="note__meta">Avís de preu · {{ item.name }}</span>
        </button>
      </template>
      <template #empty>
        {{ NO_NOTES }}
      </template>
    </MarketFeed>

    <template v-if="operation && verification.canOperate">
      <BuyCard
        v-if="operation.type === 'buy'"
        :key="`buy-${operation.asset.id}`"
        :asset="operation.asset"
        @close="close"
      />
      <SellCard
        v-else
        :key="`sell-${operation.asset.id}`"
        :asset="operation.asset"
        @close="close"
      />
    </template>

    <AssetSearch
      v-model:query="searchQuery"
      :selectable="verification.canOperate"
      :holdings="account.positions"
      @select="open('buy', $event)"
      @sell="open('sell', $event)"
    />
  </UiPage>
</template>

<style scoped>
/* Tota la targeta de l'avís és un botó */
.note {
  display: grid;
  /* El contingut a dalt: les targetes fan totes la mateixa alçada, encara que el text ocupi més o menys línies */
  align-content: start;
  justify-items: start;
  gap: var(--tub-space-3);
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
/* El contorn va per dins: la cinta retalla el que sobresurt */
.note:focus-visible {
  outline: 2px solid var(--tub-primary);
  outline-offset: -2px;
  border-radius: var(--tub-radius-sm);
}
.note__icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--tub-radius-pill);
  font-weight: 700;
}
.note__icon--up {
  background: var(--tub-green-soft);
  color: var(--tub-green-dark);
}
.note__icon--down {
  background: var(--tub-danger-bg);
  color: var(--tub-danger-text);
}
.note__text {
  color: var(--tub-text);
}
.note__meta {
  font-size: var(--tub-text-sm);
  color: var(--tub-text-muted);
}
</style>
