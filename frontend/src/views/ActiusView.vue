<script setup>
import AssetSearch from '../components/AssetSearch.vue'

// Actius només té el cercador (US5.1). El saldo és a Compte d'efectiu (US3.2), i cercar no és operar: el cercador
// surt a tots els usuaris registrats, encara que no estiguin verificats
</script>

<template>
  <section class="page">
    <h1>Actius</h1>

    <AssetSearch />
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--tub-space-5);
  max-width: 720px;
  padding: var(--tub-space-6) var(--tub-space-5);
}

@media (max-width: 900px) {
  .page {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
}
</style>
