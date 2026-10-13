<script setup>
import { RouterView, useRoute } from 'vue-router'
import AppNavBar from './components/AppNavBar.vue'

const route = useRoute()
</script>

<template>
  <AppNavBar v-if="!route.meta.hideNav" />
  <main>
    <RouterView />
  </main>
</template>