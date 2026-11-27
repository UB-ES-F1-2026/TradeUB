<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { UiButton, UiCard, UiLogo, UiPage } from '../components/ui'

// Pàgina 404 (Technical Debt 4): la ruta comodí no demana sessió. Amb sessió surt dins del contenidor comú, sota la
// barra; sense sessió, sense barra i amb el logo a dalt. En tots dos casos, una targeta centrada amb una icona (variant
// B dels mocks). "Torna a l'inici" porta a Actius, i sense sessió el guard ja hi posa l'inici de sessió al davant
const authStore = useAuthStore()
const router = useRouter()

// Amb la 2FA pendent la barra tampoc surt (App.vue): es mostra com si no hi hagués sessió
const withNav = computed(() => authStore.isAuthenticated && !authStore.needsMfa)

function goHome() {
  router.push('/actius')
}
</script>

<template>
  <!-- Amb sessió, dins del contenidor comú (sense capçalera: el títol és a la targeta); sense sessió, a pantalla
       completa amb el logo a dalt -->
  <component
    :is="withNav ? UiPage : 'div'"
    :class="{ 'not-found': !withNav }"
  >
    <UiLogo
      v-if="!withNav"
      size="md"
      class="not-found__logo"
    />
    <div class="not-found__center">
      <UiCard
        padding="lg"
        class="not-found__card"
      >
        <svg
          class="not-found__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle
            cx="10.5"
            cy="10.5"
            r="6.5"
          />
          <path d="M7.5 10.5h6M15.5 15.5 20 20" />
        </svg>
        <p class="eyebrow">
          Error 404
        </p>
        <h1 class="not-found__title">
          Pàgina no trobada
        </h1>
        <p class="not-found__text">
          L'adreça que has obert no existeix o ja no està disponible.
        </p>
        <UiButton
          data-test="not-found-home"
          @click="goHome"
        >
          Torna a l'inici
        </UiButton>
      </UiCard>
    </div>
  </component>
</template>

<style scoped>
/* Sense sessió: el logo a dalt a l'esquerra i la targeta al centre de la pantalla */
.not-found {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  padding: var(--tub-space-6);
}
.not-found__logo {
  justify-self: start;
}
.not-found__center {
  display: grid;
  place-items: center;
  padding-block: var(--tub-space-8);
}
.not-found__card {
  display: grid;
  justify-items: center;
  gap: var(--tub-space-3);
  max-width: 540px;
  text-align: center;
}
.not-found__icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--tub-text-muted);
}
.not-found__title {
  margin: 0;
  font-size: var(--tub-text-2xl);
}
.not-found__text {
  margin-bottom: var(--tub-space-3);
  color: var(--tub-text-2);
}

@media (max-width: 900px) {
  .not-found {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
  .not-found__center {
    padding-block: var(--tub-space-6);
  }
}
</style>
