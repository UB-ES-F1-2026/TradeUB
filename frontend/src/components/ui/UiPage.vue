<script setup>
// Contenidor comú de les pantalles amb la barra de navegació (Technical Debt 4): centrat i d'amplada màxima 1120 px,
// amb una capçalera que té el h1 i, opcionalment, una acció a la dreta. El títol és el mateix que l'etiqueta de la
// barra. Si el títol no és un text fix (com el nom a Perfil), es passa pel slot "title"
defineProps({
  title: { type: String, default: '' },
})
</script>

<template>
  <section class="ui-page">
    <!-- Sense títol ni accions no hi ha capçalera: la 404 porta el títol dins de la seva targeta -->
    <header
      v-if="title || $slots.title || $slots.actions"
      class="ui-page__head"
    >
      <slot name="title">
        <h1 class="ui-page__title">
          {{ title }}
        </h1>
      </slot>
      <div
        v-if="$slots.actions"
        class="ui-page__actions"
      >
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.ui-page {
  display: grid;
  gap: var(--tub-space-5);
  width: min(100%, 1120px);
  margin-inline: auto;
  padding: var(--tub-space-6) var(--tub-space-5);
}
.ui-page__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--tub-space-4);
}
.ui-page__title {
  margin: 0;
}
.ui-page__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}

@media (max-width: 900px) {
  .ui-page {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
}
</style>
