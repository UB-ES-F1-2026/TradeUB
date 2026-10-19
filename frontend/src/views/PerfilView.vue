<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { UiAlert, UiBadge, UiButton, UiCard } from '../components/ui'

const authStore = useAuthStore()
const router = useRouter()

const loggingOut = ref(false)
const error = ref('')

// Dades personals: de moment surten de user_metadata; quan hi hagi backend (taula profiles) es substitueixen
const meta = computed(() => authStore.user?.user_metadata ?? {})
const fullName = computed(() => {
  const name = [meta.value.first_name, meta.value.last_name].filter(Boolean).join(' ')
  return name || 'Perfil'
})
const personalRows = computed(() => [
  { label: 'Nom', value: meta.value.first_name },
  { label: 'Cognoms', value: meta.value.last_name },
  { label: 'Telèfon', value: meta.value.phone },
  { label: 'Data de naixement', value: formatDate(meta.value.birthdate) },
  { label: 'Adreça', value: meta.value.address },
])

// Verificació d'identitat: de moment un marcador a user_metadata; quan hi hagi backend vindrà de la taula de verificacions
const verificat = computed(() => meta.value.verified === true)

// Dades del compte: vénen de Supabase Auth
const email = computed(() => authStore.user?.email ?? '')
const userId = computed(() => authStore.user?.id ?? '—')
const createdAt = computed(() => formatDate(authStore.user?.created_at))
const lastSignIn = computed(() => formatDate(authStore.user?.last_sign_in_at))

// Targetes resum: de moment valors de mostra fins que hi hagi dades reals
const patrimonio = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(0)
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
        <h1 class="page__title">{{ fullName }}</h1>
      </div>
      <div class="page__status">
        <UiBadge :variant="verificat ? 'success' : 'neutral'">
          {{ verificat ? 'Verificat' : 'No verificat' }}
        </UiBadge>
        <UiButton
          v-if="!verificat"
          variant="primary"
          size="sm"
          disabled
        >
          Verifica't · Pròximament
        </UiButton>
      </div>
    </header>

    <div class="page__tiles">
      <RouterLink
        to="/cartera"
        class="page__tile"
      >
        <UiCard padding="md">
          <span class="page__tile-label">Patrimoni</span>
          <span class="page__tile-value tabular">{{ patrimonio }}</span>
        </UiCard>
      </RouterLink>
      <RouterLink
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
      <h2 class="page__section-title">Dades personals</h2>
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
      <h2 class="page__section-title">Compte</h2>
      <dl class="page__data">
        <div class="page__row">
          <dt>Correu electrònic</dt>
          <dd class="tabular">{{ email }}</dd>
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
          <dd class="tabular page__id">{{ userId }}</dd>
        </div>
      </dl>
    </UiCard>

    <UiCard class="page__card">
      <div class="page__settings">
        <div>
          <h2 class="page__section-title">Configuració</h2>
          <p class="page__muted">Seguretat, aparença i més</p>
        </div>
        <UiBadge variant="neutral">Pròximament</UiBadge>
      </div>
    </UiCard>

    <UiCard class="page__card">
      <div class="page__session">
        <div>
          <h2 class="page__section-title">Sessió</h2>
          <p class="page__muted">Tanca la sessió en aquest dispositiu.</p>
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
  max-width: 720px;
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
