<script setup>
import { ref, watch } from 'vue'
import { apiGet, ApiError } from '../services/api'
import { UiAlert, UiButton, UiDialog } from './ui'
import { ORDER_LOAD_ERROR, orderDetailRows } from '../utils/orders'

// Detall d'una compra o venda de l'historial (US6.5). S'obre amb l'id de l'ordre de la fila i el tanca el pare
// (orderId a null). Obrir-lo i tancar-lo no canvia de ruta ni toca la llista de l'historial (C5)
const props = defineProps({
  orderId: { type: String, default: null },
})
const emit = defineEmits(['close'])

const rows = ref([])
const loading = ref(false)
const error = ref('')

// Si es tanca i s'obre una altra fila abans que arribi la resposta, la resposta vella no s'aplica
let lastRequest = 0

async function load(id) {
  const request = ++lastRequest
  rows.value = []
  error.value = ''
  loading.value = true
  try {
    const order = await apiGet(`/orders/${encodeURIComponent(id)}`)
    if (request !== lastRequest) return
    rows.value = orderDetailRows(order)
  } catch (e) {
    if (request !== lastRequest) return
    // 404 ("Operació no trobada") i 403 porten un missatge pensat per a l'usuari
    error.value = e instanceof ApiError && [403, 404].includes(e.status) ? e.message : ORDER_LOAD_ERROR
  } finally {
    if (request === lastRequest) loading.value = false
  }
}

watch(() => props.orderId, (id) => {
  if (id) load(id)
  else lastRequest += 1
}, { immediate: true })
</script>

<template>
  <UiDialog
    :open="Boolean(orderId)"
    title="Detall de l'operació"
    size="md"
    @close="emit('close')"
  >
    <p
      v-if="loading"
      class="order__muted"
    >
      Carregant el detall…
    </p>

    <UiAlert
      v-else-if="error"
      variant="error"
      data-test="order-error"
    >
      {{ error }}
    </UiAlert>

    <dl
      v-else
      class="order__data"
    >
      <div
        v-for="row in rows"
        :key="row.key"
        class="order__row"
        :data-test="`order-${row.key}`"
      >
        <dt class="order__label">
          {{ row.label }}
        </dt>
        <dd
          class="order__value"
          :class="{ tabular: row.numeric }"
        >
          {{ row.value }}
        </dd>
      </div>
    </dl>

    <template #footer>
      <UiButton
        variant="secondary"
        data-test="order-close"
        @click="emit('close')"
      >
        Tanca
      </UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.order__muted {
  color: var(--tub-text-muted);
}
.order__data {
  display: grid;
  margin: 0;
}
.order__row {
  display: flex;
  justify-content: space-between;
  gap: var(--tub-space-4);
  padding: var(--tub-space-2) 0;
  border-bottom: 1px solid var(--tub-border);
}
.order__row:last-child {
  border-bottom: 0;
}
.order__label {
  color: var(--tub-text-muted);
}
.order__value {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
</style>
