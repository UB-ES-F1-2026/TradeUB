<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { UiButton, UiCard, UiLogo, UiPage } from '../components/ui'

// Pàgina 404 (Technical Debt 4): la ruta comodí no demana sessió. Amb sessió surt dins del contenidor comú, sota la
// barra; sense sessió, centrada i sense barra. "Torna a l'inici" porta a Actius, i sense sessió el guard ja hi posa
// l'inici de sessió al davant
const authStore = useAuthStore()
const router = useRouter()

// Amb la 2FA pendent la barra tampoc surt (App.vue): es mostra com si no hi hagués sessió
const withNav = computed(() => authStore.isAuthenticated && !authStore.needsMfa)

const TEXT = "La pàgina que busques no existeix o s'ha mogut."

function goHome() {
  router.push('/actius')
}
</script>

<template>
  <UiPage
    v-if="withNav"
    title="Pàgina no trobada"
  >
    <UiCard
      padding="md"
      class="not-found__card"
    >
      <p class="not-found__text">
        {{ TEXT }}
      </p>
      <div>
        <UiButton
          data-test="not-found-home"
          @click="goHome"
        >
          Torna a l'inici
        </UiButton>
      </div>
    </UiCard>
  </UiPage>

  <div
    v-else
    class="not-found"
  >
    <UiCard
      padding="lg"
      class="not-found__card not-found__card--guest"
    >
      <UiLogo size="md" />
      <h1>Pàgina no trobada</h1>
      <p class="not-found__text">
        {{ TEXT }}
      </p>
      <UiButton
        block
        data-test="not-found-home"
        @click="goHome"
      >
        Torna a l'inici
      </UiButton>
    </UiCard>
  </div>
</template>

<style scoped>
.not-found {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: var(--tub-space-6) var(--tub-space-5);
}
.not-found__card {
  display: grid;
  gap: var(--tub-space-4);
}
.not-found__card--guest {
  max-width: 420px;
  justify-items: center;
  text-align: center;
}
.not-found__text {
  color: var(--tub-text-muted);
}

@media (max-width: 900px) {
  .not-found {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
}
</style>
