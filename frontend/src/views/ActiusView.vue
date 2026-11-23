<script setup>
import { onMounted, ref } from 'vue'
import AssetSearch from '../components/AssetSearch.vue'
import BuyCard from '../components/BuyCard.vue'
import { useVerificationStore } from '../stores/verification'

// Actius té el cercador (US5.1) i la compra (US6.1). El saldo és a Compte d'efectiu (US3.2), i cercar no és
// operar: el cercador surt a tots els usuaris registrats, encara que no estiguin verificats. Només qui pot operar
// (identitat verificada i termes acceptats) pot triar un resultat per comprar-lo; el backend també ho comprova
const verification = useVerificationStore()

// Actiu triat a la cerca. La targeta de compra es tanca en cancel·lar o quan la compra ha anat bé
const selected = ref(null)

// La verificació es llegeix sense bloquejar el cercador. Fins que arriba (o si falla) no es pot triar cap actiu
onMounted(verification.load)

// La targeta va a dalt, sota el títol: si l'usuari havia baixat per la llista, es torna a dalt de la pàgina.
// Si ja hi és, no es mou res
function selectAsset(asset) {
  selected.value = asset
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <section class="page">
    <h1>Actius</h1>

    <BuyCard
      v-if="selected && verification.canOperate"
      :key="selected.id"
      :asset="selected"
      @close="selected = null"
    />

    <AssetSearch
      :selectable="verification.canOperate"
      @select="selectAsset"
    />
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
