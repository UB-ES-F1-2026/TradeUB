<script setup>
import { onMounted, ref, watch } from 'vue'
import VerificationRequired from '../components/VerificationRequired.vue'
import { UiAlert, UiButton, UiCard, UiInput, UiSelect } from '../components/ui'
import { useMovementsStore } from '../stores/movements'
import { useVerificationStore } from '../stores/verification'
import { formatCurrency } from '../utils/currency'
import {
  MOVEMENT_TYPE_OPTIONS,
  formatMovementDate,
  formatMovementTime,
  formatSignedAmount,
  isIncoming,
  movementTypeLabel,
} from '../utils/movements'

// L'historial només està disponible amb la identitat verificada i els termes acceptats (US2.4).
// El backend també ho comprova a GET /account/movements
const verification = useVerificationStore()
const movements = useMovementsStore()

// Fins que no s'ha comprovat l'estat en aquesta visita no es mostra ni l'historial ni l'avís
const checked = ref(false)

onMounted(async () => {
  await verification.load()
  checked.value = true
  if (verification.canOperate) movements.fetchMovements()
})

// Qualsevol canvi de filtre recarrega des de la primera pàgina
watch(() => ({ ...movements.filters }), () => movements.applyFilters())
</script>

<template>
  <section class="page">
    <h1>Historial</h1>

    <p
      v-if="!checked || verification.loading"
      class="page__muted"
    >
      Comprovant l'estat del compte…
    </p>

    <UiAlert
      v-else-if="verification.error"
      variant="error"
    >
      {{ verification.error }}
    </UiAlert>

    <template v-else-if="verification.canOperate">
      <UiCard
        padding="md"
        class="filters"
        data-test="movement-filters"
      >
        <UiInput
          v-model="movements.filters.from"
          label="Data inici"
          type="date"
          data-test="filter-from"
        />
        <UiInput
          v-model="movements.filters.to"
          label="Data fi"
          type="date"
          :error="movements.dateRangeError"
          data-test="filter-to"
        />
        <UiSelect
          v-model="movements.filters.type"
          label="Tipus"
          :options="MOVEMENT_TYPE_OPTIONS"
          data-test="filter-type"
        />
      </UiCard>

      <UiAlert
        v-if="movements.error"
        variant="error"
      >
        {{ movements.error }}
      </UiAlert>

      <p
        v-else-if="movements.loading && !movements.movements.length"
        class="page__muted"
      >
        Carregant els moviments…
      </p>

      <UiCard
        v-else-if="!movements.movements.length && !movements.dateRangeError"
        padding="lg"
        class="empty"
        data-test="movements-empty"
      >
        <svg
          class="empty__icon"
          viewBox="0 0 24 24"
          width="40"
          height="40"
          aria-hidden="true"
        >
          <circle
            cx="11"
            cy="11"
            r="7"
          />
          <path d="M8 11h6M16.5 16.5L21 21" />
        </svg>
        <p class="empty__text">
          No s'han trobat moviments per als filtres seleccionats.
        </p>
      </UiCard>

      <template v-else-if="movements.movements.length">
        <UiCard
          padding="md"
          class="list"
          :class="{ 'list--loading': movements.loading }"
          :aria-busy="movements.loading"
        >
          <table class="movements">
            <thead>
              <tr class="eyebrow">
                <th scope="col">
                  Data
                </th>
                <th scope="col">
                  Concepte
                </th>
                <th
                  scope="col"
                  class="movements__num"
                >
                  Import
                </th>
                <th
                  scope="col"
                  class="movements__num"
                >
                  Saldo resultant
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(movement, index) in movements.movements"
                :key="`${movement.created_at}-${index}`"
                class="movements__row"
                data-test="movement-row"
              >
                <td class="movements__date">
                  <span class="movements__main tabular">{{ formatMovementDate(movement.created_at) }}</span>
                  <span class="movements__sub tabular">{{ formatMovementTime(movement.created_at) }}</span>
                </td>
                <td class="movements__concept">
                  <span class="movements__main">{{ movement.concept }}</span>
                  <span
                    class="movements__sub"
                    data-test="movement-type"
                  >{{ movementTypeLabel(movement.type) }}</span>
                </td>
                <td
                  class="movements__num movements__amount tabular"
                  :class="isIncoming(movement.amount) ? 'movements__amount--in' : 'movements__amount--out'"
                  data-test="movement-amount"
                >
                  {{ formatSignedAmount(movement.amount) }}
                </td>
                <td
                  class="movements__num movements__balance tabular"
                  data-test="movement-balance"
                >
                  <span class="movements__balance-label">Saldo </span>{{ formatCurrency(Number(movement.balance_after)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </UiCard>

        <nav
          class="pagination"
          aria-label="Paginació de l'historial"
        >
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="movements.page <= 1 || movements.loading"
            data-test="page-prev"
            @click="movements.prevPage()"
          >
            Anterior
          </UiButton>
          <span
            class="pagination__page"
            data-test="page-number"
          >Pàgina {{ movements.page }}</span>
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="!movements.hasMore || movements.loading"
            data-test="page-next"
            @click="movements.nextPage()"
          >
            Següent
          </UiButton>
        </nav>
      </template>
    </template>

    <VerificationRequired
      v-else
      message="Verifica la teva identitat i accepta els termes i condicions per consultar l'historial de moviments."
    />
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--tub-space-5);
  max-width: 1040px;
  padding: var(--tub-space-6) var(--tub-space-5);
}
.page__muted {
  color: var(--tub-text-muted);
}

.filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--tub-space-4);
  /* Els camps porten marge inferior propi; es compensa perquè la targeta quedi equilibrada */
  padding-bottom: var(--tub-space-2);
}

.empty {
  display: grid;
  justify-items: center;
  gap: var(--tub-space-3);
  text-align: center;
}
.empty__icon {
  fill: none;
  stroke: var(--tub-text-muted);
  stroke-width: 2;
  stroke-linecap: round;
}
.empty__text {
  font-size: var(--tub-text-lg);
  font-weight: 600;
  color: var(--tub-text);
}

.list--loading {
  opacity: 0.6;
}

.movements {
  width: 100%;
  border-collapse: collapse;
}
.movements th {
  padding: var(--tub-space-3) var(--tub-space-3);
  border-bottom: 1px solid var(--tub-border);
  color: var(--tub-text-muted);
  text-align: left;
}
.movements td {
  padding: var(--tub-space-4) var(--tub-space-3);
  border-bottom: 1px solid var(--tub-border);
  vertical-align: middle;
}
.movements__row:last-child td {
  border-bottom: 0;
}
.movements .movements__num {
  text-align: right;
  white-space: nowrap;
}
.movements__date,
.movements__concept {
  display: grid;
  gap: var(--tub-space-1);
}
.movements__main {
  font-weight: 600;
  color: var(--tub-text);
}
.movements__sub {
  font-size: var(--tub-text-sm);
  color: var(--tub-text-muted);
}
.movements__amount {
  font-weight: 600;
}
.movements__amount--in {
  color: var(--tub-green-dark);
}
.movements__amount--out {
  color: var(--tub-danger-text);
}
.movements__balance {
  color: var(--tub-text);
}
.movements__balance-label {
  display: none;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tub-space-3);
}
.pagination__page {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}

@media (max-width: 900px) {
  .page {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
  .filters {
    grid-template-columns: 1fr;
    gap: 0;
  }

  /* Cada moviment passa a ser un bloc: concepte i import a dalt, data i saldo a sota */
  .movements thead {
    display: none;
  }
  .movements__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'concept amount'
      'date balance';
    gap: var(--tub-space-1) var(--tub-space-3);
    padding: var(--tub-space-3) 0;
    border-bottom: 1px solid var(--tub-border);
  }
  .movements__row:last-child {
    border-bottom: 0;
  }
  .movements td,
  .movements__row:last-child td {
    padding: 0;
    border-bottom: 0;
  }
  .movements__concept {
    grid-area: concept;
  }
  .movements__amount {
    grid-area: amount;
  }
  .movements__date {
    grid-area: date;
    display: flex;
    gap: var(--tub-space-2);
  }
  .movements__date .movements__main {
    font-size: var(--tub-text-sm);
    font-weight: 400;
    color: var(--tub-text-muted);
  }
  .movements__balance {
    grid-area: balance;
    font-size: var(--tub-text-sm);
    color: var(--tub-text-muted);
  }
  .movements__balance-label {
    display: inline;
  }
}
</style>
