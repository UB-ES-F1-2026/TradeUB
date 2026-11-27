<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNavBar from './components/AppNavBar.vue'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const authStore = useAuthStore()

// La barra només surt amb una sessió iniciada, i no mentre el codi de la 2FA és pendent. Així tampoc surt a /ui ni a
// la pàgina 404 sense sessió. Les pantalles d'accés i l'onboarding l'amaguen sempre (meta.hideNav)
const showNav = computed(() => authStore.isAuthenticated && !authStore.needsMfa && !route.meta.hideNav)
</script>

<template>
  <AppNavBar v-if="showNav" />
  <main>
    <RouterView />
  </main>
</template>