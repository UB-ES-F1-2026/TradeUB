<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiGet } from '../services/api'
import { UiAlert, UiBadge, UiButton, UiCard, UiInput } from './ui'
import { ASSETS_LOAD_ERROR, NO_ASSETS_FOUND, SEARCH_DELAY_MS, assetTypeLabel, assetsSearchPath } from '../utils/assets'

// Cercador d'actius (US5.1). Cerca mentre s'escriu pel nom, el ticker o l'ISIN; sense text mostra tot el catàleg.
// Cercar no és operar: es mostra a tots els usuaris registrats, encara que no estiguin verificats
// Amb selectable (només si l'usuari pot operar), cada resultat es pot triar per comprar-lo (US6.1, event select) i,
// si l'usuari en té unitats a holdings, per vendre-les (US6.2, event sell)
const props = defineProps({
  selectable: { type: Boolean, default: false },
  // Unitats de cada posició per id d'actiu, com account.positions
  holdings: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['select', 'sell'])

const canSell = (asset) => props.selectable && (props.holdings[asset.id] ?? 0) > 0

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
    <p class="eyebrow">
      Cercar actius
    </p>

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
          :class="{ 'assets__item--selectable': selectable }"
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
          <UiButton
            v-if="selectable"
            variant="secondary"
            size="sm"
            :aria-label="`Comprar ${asset.name}`"
            data-test="asset-select"
            @click="emit('select', asset)"
          >
            Compra
          </UiButton>
          <UiButton
            v-if="canSell(asset)"
            variant="ghost"
            size="sm"
            :aria-label="`Vendre ${asset.name}`"
            data-test="asset-sell"
            @click="emit('sell', asset)"
          >
            Ven
          </UiButton>
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
/* Amb els botons "Compra" i "Ven", el nom ocupa l'espai lliure i el tipus i els botons queden a la dreta */
.assets__item--selectable .assets__info {
  flex: 1;
}
.assets__info {
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

/* A mòbil no hi caben el nom, el tipus i els dos botons en una línia: el nom va a dalt i la resta a sota */
@media (max-width: 900px) {
  .assets__item--selectable {
    flex-wrap: wrap;
    gap: var(--tub-space-2) var(--tub-space-3);
  }
  .assets__item--selectable .assets__info {
    flex-basis: 100%;
  }
}
</style>
