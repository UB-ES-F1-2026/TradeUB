<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { useAuthStore } from '../stores/auth'
import { useProfileStore } from '../stores/profile'
import { useVerificationStore } from '../stores/verification'
import { formatCurrency } from '../utils/currency'
import { INCOMPLETE_FEATURES_ENABLED } from '../config/features'
import { UiAlert, UiBadge, UiButton, UiCard } from '../components/ui'
import TwoFactorCard from '../components/TwoFactorCard.vue'

const authStore = useAuthStore()
const router = useRouter()

const loggingOut = ref(false)
const error = ref('')

// Dades personals: vénen del backend (taula profiles). La resta de dades del compte, de Supabase Auth
const profileStore = useProfileStore()
onMounted(profileStore.load)
const perfil = computed(() => profileStore.perfil)
const fullName = computed(() => {
  const name = [perfil.value.nom, perfil.value.cognoms].filter(Boolean).join(' ')
  return name || 'Perfil'
})
const address = computed(() => {
  const { carrer, codi_postal, poblacio } = perfil.value
  return [carrer, [codi_postal, poblacio].filter(Boolean).join(' ')].filter(Boolean).join(', ')
})
const personalRows = computed(() => [
  { label: 'Nom', value: perfil.value.nom },
  { label: 'Cognoms', value: perfil.value.cognoms },
  { label: 'Telèfon', value: perfil.value.telefon },
  { label: 'Data de naixement', value: formatDate(perfil.value.data_naixement) },
  { label: 'Adreça', value: address.value },
])

// Verificació (US2.4): ve del backend (GET /users/me). Compta com a verificat amb la identitat verificada
// i els termes vigents acceptats, el mateix criteri que fa servir el backend per a l'operativa
// Si no es pot comprovar, es manté l'últim estat conegut (d'entrada, no verificat)
const verification = useVerificationStore()
onMounted(verification.load)
const verificat = computed(() => verification.canOperate)

// Dades del compte: vénen de Supabase Auth
const email = computed(() => authStore.user?.email ?? '')
const userId = computed(() => authStore.user?.id ?? '—')
const createdAt = computed(() => formatDate(authStore.user?.created_at))
const lastSignIn = computed(() => formatDate(authStore.user?.last_sign_in_at))

// Patrimoni = saldo del compte (encara no hi ha posicions); missatges, valor de mostra
const accountStore = useAccountStore()
onMounted(accountStore.fetchBalance)
const patrimonio = computed(() =>
  accountStore.hasBalance ? formatCurrency(accountStore.balance, accountStore.currency) : '—',
)
const missatges = 0

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ca-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function display(value) {
  return value || '—'
}

async function handleLogout() {
  error.value = ''
  loggingOut.value = true
  try {
    await authStore.logout()
    await router.replace({ name: 'login' })
  } catch {
    error.value = "No s'ha pogut tancar la sessió. Torna-ho a provar."
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <section class="page">
    <header class="page__head">
      <div class="page__head-main">
        <span class="eyebrow">Compte</span>
        <h1 class="page__title">
          {{ fullName }}
        </h1>
      </div>
      <div class="page__status">
        <UiBadge :variant="verificat ? 'success' : 'neutral'">
          {{ verificat ? 'Verificat' : 'No verificat' }}
        </UiBadge>
        <UiButton
          v-if="!verificat"
          variant="primary"
          size="sm"
          @click="router.push({ name: 'onboarding' })"
        >
          Verifica't
        </UiButton>
      </div>
    </header>

    <div class="page__tiles">
      <RouterLink
        v-if="INCOMPLETE_FEATURES_ENABLED"
        to="/cartera"
        class="page__tile"
      >
        <UiCard padding="md">
          <span class="page__tile-label">Patrimoni</span>
          <span class="page__tile-value tabular">{{ patrimonio }}</span>
        </UiCard>
      </RouterLink>
      <RouterLink
        v-if="INCOMPLETE_FEATURES_ENABLED"
        to="/bustia"
        class="page__tile"
      >
        <UiCard padding="md">
          <span class="page__tile-label">Missatges</span>
          <span class="page__tile-value tabular">{{ missatges }}</span>
        </UiCard>
      </RouterLink>
    </div>

    <UiCard class="page__card">
      <h2 class="page__section-title">
        Dades personals
      </h2>
      <dl class="page__data">
        <div
          v-for="row in personalRows"
          :key="row.label"
          class="page__row"
        >
          <dt>{{ row.label }}</dt>
          <dd>{{ display(row.value) }}</dd>
        </div>
      </dl>
    </UiCard>

    <UiCard class="page__card">
      <h2 class="page__section-title">
        Compte
      </h2>
      <dl class="page__data">
        <div class="page__row">
          <dt>Correu electrònic</dt>
          <dd class="tabular">
            {{ email }}
          </dd>
        </div>
        <div class="page__row">
          <dt>Compte creat</dt>
          <dd>{{ createdAt }}</dd>
        </div>
        <div class="page__row">
          <dt>Últim inici de sessió</dt>
          <dd>{{ lastSignIn }}</dd>
        </div>
        <div class="page__row">
          <dt>Identificador</dt>
          <dd class="tabular page__id">
            {{ userId }}
          </dd>
        </div>
      </dl>
    </UiCard>

    <TwoFactorCard />

    <UiCard
      v-if="INCOMPLETE_FEATURES_ENABLED"
      class="page__card"
    >
      <div class="page__settings">
        <div>
          <h2 class="page__section-title">
            Configuració
          </h2>
          <p class="page__muted">
            Seguretat, aparença i més
          </p>
        </div>
        <UiBadge variant="neutral">
          Pròximament
        </UiBadge>
      </div>
    </UiCard>

    <UiCard class="page__card">
      <div class="page__session">
        <div>
          <h2 class="page__section-title">
            Sessió
          </h2>
          <p class="page__muted">
            Tanca la sessió en aquest dispositiu.
          </p>
        </div>
        <UiButton
          variant="secondary"
          :loading="loggingOut"
          @click="handleLogout"
        >
          Tanca la sessió
        </UiButton>
      </div>
      <UiAlert
        v-if="error"
        variant="error"
      >
        {{ error }}
      </UiAlert>
    </UiCard>
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--tub-space-5);
  width: min(100%, 960px);
  margin-inline: auto;
  padding: var(--tub-space-6) var(--tub-space-5);
}
.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--tub-space-4);
}
.page__head-main {
  display: grid;
  gap: var(--tub-space-1);
}
.page__status {
  display: flex;
  align-items: center;
  gap: var(--tub-space-3);
}
.page__title {
  font-size: var(--tub-text-xl);
}

.page__tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--tub-space-4);
}
.page__tile {
  color: inherit;
  text-decoration: none;
}
.page__tile-label {
  display: block;
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}
.page__tile-value {
  display: block;
  margin-top: var(--tub-space-2);
  font-size: var(--tub-text-lg);
  font-weight: 600;
}

.page__card {
  display: grid;
  gap: var(--tub-space-4);
}
.page__section-title {
  font-size: var(--tub-text-md);
}
.page__data {
  display: grid;
  gap: var(--tub-space-4);
  margin: 0;
}
.page__row {
  display: flex;
  justify-content: space-between;
  gap: var(--tub-space-4);
  padding-bottom: var(--tub-space-4);
  border-bottom: 1px solid var(--tub-border);
}
.page__row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}
.page__row dt {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}
.page__row dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.page__id {
  font-size: var(--tub-text-xs);
}

.page__settings,
.page__session {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tub-space-4);
}
.page__muted {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}

@media (max-width: 900px) {
  .page {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
  .page__settings,
  .page__session {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
