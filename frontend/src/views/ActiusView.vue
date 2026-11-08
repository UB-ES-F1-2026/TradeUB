<script setup>
import BalanceCard from '../components/BalanceCard.vue'
</script>

<template>
  <section class="page">
    <h1>Actius</h1>
    <BalanceCard />
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
