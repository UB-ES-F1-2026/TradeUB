<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiGet } from '../services/api'
import { UiAlert, UiBadge, UiCard, UiInput } from './ui'
import {
  ASSETS_LOAD_ERROR,
  NO_ASSETS_FOUND,
  SEARCH_DELAY_MS,
  assetTypeLabel,
  assetsSearchPath,
  dailyChangeTrend,
  formatClosePrice,
  formatDailyChange,
  formatPriceDate,
} from '../utils/assets'

// Cercador d'actius (US5.1). Cerca mentre s'escriu pel nom, el ticker o l'ISIN; sense text mostra tot el catàleg.
// Cercar no és operar: es mostra a tots els usuaris registrats, encara que no estiguin verificats
const query = ref('')
const assets = ref([])
const loading = ref(false)
const error = ref('')

let timer = null
let lastRequest = 0

async function search() {
  const request = ++lastRequest
  const text = query.value.trim()
  loading.value = true
  error.value = ''
  try {
    const data = await apiGet(assetsSearchPath(text))
    // Si mentrestant s'ha fet una altra cerca, aquesta resposta ja no s'aplica
    if (request !== lastRequest) return
    assets.value = Array.isArray(data) ? data : []
  } catch {
    if (request !== lastRequest) return
    assets.value = []
    error.value = ASSETS_LOAD_ERROR
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

// S'espera que l'usuari pari d'escriure per no fer una petició a cada tecla
watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(search, SEARCH_DELAY_MS)
})

onMounted(search)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <UiCard class="assets">
    <div class="assets__header">
      <p class="eyebrow">
        Cercar actius
      </p>
      <!-- El catàleg és simulat: els preus no són de mercat (US5.3) -->
      <UiBadge data-test="simulated-prices">
        Preus simulats
      </UiBadge>
    </div>

    <UiInput
      v-model="query"
      label="Nom, ticker o ISIN"
      type="search"
      placeholder="Ex.: Apple, AAPL o US0378331005"
      data-test="asset-search"
    />

    <div aria-live="polite">
      <UiAlert
        v-if="error"
        variant="error"
      >
        {{ error }}
      </UiAlert>

      <p
        v-else-if="!assets.length && loading"
        class="assets__muted"
      >
        Carregant actius…
      </p>

      <p
        v-else-if="!assets.length"
        class="assets__muted"
        data-test="no-results"
      >
        {{ NO_ASSETS_FOUND }}
      </p>

      <ul
        v-else
        class="assets__list"
        :aria-busy="loading"
      >
        <li
          v-for="asset in assets"
          :key="asset.ticker"
          class="assets__item"
          data-test="asset-result"
        >
          <div class="assets__info">
            <p class="assets__name">
              {{ asset.name }}
            </p>
            <p class="assets__ticker tabular">
              {{ asset.ticker }}
            </p>
          </div>
          <UiBadge>{{ assetTypeLabel(asset.type) }}</UiBadge>
          <!-- Últim preu de tancament, variació diària i data de la cotització del catàleg simulat (US5.3) -->
          <div class="assets__quote tabular">
            <p
              class="assets__price"
              data-test="asset-price"
            >
              {{ formatClosePrice(asset.close_price_eur) }}
            </p>
            <p
              class="assets__change"
              :class="`assets__change--${dailyChangeTrend(asset.daily_change_pct)}`"
              data-test="asset-change"
            >
              {{ formatDailyChange(asset.daily_change_pct) }}
            </p>
            <p
              class="assets__date"
              data-test="asset-date"
            >
              {{ formatPriceDate(asset.price_date) }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </UiCard>
</template>

<style scoped>
.assets {
  display: grid;
  gap: var(--tub-space-3);
}
.assets__muted {
  color: var(--tub-text-muted);
}
.assets__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.assets__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tub-space-4);
  padding: var(--tub-space-3) 0;
  border-top: 1px solid var(--tub-border);
}
.assets__info {
  flex: 1;
  min-width: 0;
}
.assets__name {
  font-weight: 600;
  color: var(--tub-text);
  overflow-wrap: anywhere;
}
.assets__ticker {
  font-size: var(--tub-text-sm);
  color: var(--tub-text-muted);
}
.assets__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tub-space-3);
}
.assets__quote {
  text-align: right;
  white-space: nowrap;
}
.assets__price {
  font-weight: 600;
  color: var(--tub-text);
}
.assets__change {
  font-size: var(--tub-text-sm);
}
.assets__date {
  font-size: var(--tub-text-xs);
  color: var(--tub-text-muted);
}
.assets__change--up {
  color: var(--tub-green-dark);
}
.assets__change--down {
  color: var(--tub-danger-text);
}
.assets__change--flat {
  color: var(--tub-text-muted);
}
</style>
