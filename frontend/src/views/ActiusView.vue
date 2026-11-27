<script setup>
import { onMounted, ref } from 'vue'
import AssetSearch from '../components/AssetSearch.vue'
import BuyCard from '../components/BuyCard.vue'
import SellCard from '../components/SellCard.vue'
import { UiBadge, UiPage } from '../components/ui'
import { useAccountStore } from '../stores/account'
import { useVerificationStore } from '../stores/verification'

// Actius té el cercador (US5.1), la compra (US6.1) i la venda (US6.2). El saldo és a Compte d'efectiu (US3.2), i
// cercar no és operar: el cercador surt a tots els usuaris registrats, encara que no estiguin verificats. Només qui
// pot operar (identitat verificada i termes acceptats) pot comprar o vendre; el backend també ho comprova
const verification = useVerificationStore()
const account = useAccountStore()

// Operació oberta: { type: 'buy' | 'sell', asset }. Només n'hi ha una alhora; la targeta es tanca en cancel·lar o
// quan l'operació ha anat bé
const operation = ref(null)

// Text del cercador. És aquí perquè l'actualitat del mercat (US17.1) hi pugui posar el ticker d'un avís
const searchQuery = ref('')

// La verificació es llegeix sense bloquejar el cercador. Fins que arriba (o si falla) no es pot triar cap actiu.
// Les posicions diuen quins actius es poden vendre; si no es poden llegir, només no surt "Ven"
onMounted(async () => {
  await verification.load()
  if (verification.canOperate) account.fetchPositions().catch(() => {})
})

// La targeta va a dalt, sota el títol: si l'usuari havia baixat per la llista, es torna a dalt de la pàgina.
// Si ja hi és, no es mou res
function open(type, asset) {
  operation.value = { type, asset }
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function close() {
  operation.value = null
}
</script>

<template>
  <UiPage title="Actius">
    <!-- El catàleg és simulat: els preus no són de mercat (US5.3) -->
    <template #actions>
      <UiBadge data-test="simulated-prices">
        Preus simulats
      </UiBadge>
    </template>

    <template v-if="operation && verification.canOperate">
      <BuyCard
        v-if="operation.type === 'buy'"
        :key="`buy-${operation.asset.id}`"
        :asset="operation.asset"
        @close="close"
      />
      <SellCard
        v-else
        :key="`sell-${operation.asset.id}`"
        :asset="operation.asset"
        @close="close"
      />
    </template>

    <AssetSearch
      v-model:query="searchQuery"
      :selectable="verification.canOperate"
      :holdings="account.positions"
      @select="open('buy', $event)"
      @sell="open('sell', $event)"
    />
  </UiPage>
</template>
