<script setup>
import { ref, watch } from 'vue'
import { apiGet, ApiError } from '../services/api'
import { UiAlert, UiBadge, UiButton, UiDialog } from './ui'
import { ORDER_LOAD_ERROR, orderDetail } from '../utils/orders'

// Detall d'una compra o venda de l'historial (US6.5). S'obre amb l'id de l'ordre de la fila i el tanca el pare
// (orderId a null). Obrir-lo i tancar-lo no canvia de ruta ni toca la llista de l'historial (C5)
const props = defineProps({
  orderId: { type: String, default: null },
})
const emit = defineEmits(['close'])

const detail = ref(null)
const loading = ref(false)
const error = ref('')

// Si es tanca i s'obre una altra fila abans que arribi la resposta, la resposta vella no s'aplica
let lastRequest = 0

async function load(id) {
  const request = ++lastRequest
  detail.value = null
  error.value = ''
  loading.value = true
  try {
    const order = await apiGet(`/orders/${encodeURIComponent(id)}`)
    if (request !== lastRequest) return
    detail.value = orderDetail(order)
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

    <div
      v-else-if="detail"
      class="order"
    >
      <!-- Rebut: l'import amb signe, el concepte i l'estat -->
      <div class="order__head">
        <p
          class="order__headline tabular"
          :class="`order__headline--${detail.trend}`"
          data-test="order-headline"
        >
          {{ detail.headline }}
        </p>
        <p
          class="order__concept"
          data-test="order-concept"
        >
          {{ detail.concept }}
        </p>
        <UiBadge
          variant="success"
          data-test="order-status"
        >
          {{ detail.status }}
        </UiBadge>
      </div>

      <section
        v-for="group in [
          { key: 'operation', title: 'Operació', rows: detail.operation },
          { key: 'amounts', title: 'Imports', rows: detail.amounts },
        ]"
        :key="group.key"
        class="order__group"
      >
        <h3 class="eyebrow">
          {{ group.title }}
        </h3>
        <dl class="order__data">
          <div
            v-for="row in group.rows"
            :key="row.key"
            class="order__row"
            :class="{ 'order__row--strong': row.strong }"
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
      </section>
    </div>

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
.order {
  display: grid;
  gap: var(--tub-space-5);
}
.order__head {
  display: grid;
  justify-items: center;
  gap: var(--tub-space-2);
  text-align: center;
}
.order__headline {
  font-size: var(--tub-text-2xl);
  font-weight: 700;
  letter-spacing: var(--tub-tracking-tight);
}
.order__headline--down {
  color: var(--tub-danger-text);
}
.order__headline--up {
  color: var(--tub-green-dark);
}
.order__concept {
  font-weight: 600;
  color: var(--tub-text-2);
}
.order__group {
  display: grid;
  gap: var(--tub-space-2);
}
.order__group h3 {
  margin: 0;
}
.order__data {
  display: grid;
  margin: 0;
  padding: 0 var(--tub-space-4);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface-2);
}
.order__row {
  display: flex;
  justify-content: space-between;
  gap: var(--tub-space-4);
  padding: var(--tub-space-3) 0;
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
  text-align: right;
  color: var(--tub-text);
}
.order__row--strong .order__label,
.order__row--strong .order__value {
  font-weight: 700;
  color: var(--tub-text);
}
</style>
