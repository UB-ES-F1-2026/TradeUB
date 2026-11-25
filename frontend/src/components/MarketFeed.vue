<script setup>
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import UiButton from './ui/UiButton.vue'

// Carrusel de targetes (US17.1). No sap què hi ha a cada targeta: el contingut arriba pel slot "item". Els avisos de
// preu (US17.1) i els titulars (US17.2) el fan servir igual
const props = defineProps({
  items: { type: Array, required: true }, // [{ id, ... }]
  label: { type: String, required: true },
  interval: { type: Number, default: 6000 },
})

// Mateix punt de tall que el CSS: a escriptori es veuen tres targetes i un tros de la quarta; a 900 px o menys, una.
// jsdom (tests) no té matchMedia
const narrowQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 900px)') : null
const narrow = ref(narrowQuery?.matches ?? false)
function onNarrowChange(event) {
  narrow.value = event.matches
}
narrowQuery?.addEventListener('change', onNarrowChange)

const visibleCount = computed(() => (narrow.value ? 1 : 3))
// La darrera posició és la que deixa la darrera targeta sencera; després es torna a la primera
const positions = computed(() => Math.max(props.items.length - visibleCount.value + 1, 1))
const canMove = computed(() => positions.value > 1)
const index = ref(0)

// Si canvien les targetes o l'amplada, la posició no pot quedar fora de rang
watch(positions, (count) => {
  if (index.value >= count) index.value = count - 1
})

function isVisible(i) {
  return i >= index.value && i < index.value + visibleCount.value
}

// Tres pauses independents (C4): el ratolí a sobre, el focus del teclat dins, i el botó "Atura", que es manté fins
// que es prem "Reprèn". Només avança si no n'hi ha cap
const root = ref(null)
const hovered = ref(false)
const focused = ref(false)
const pausedByUser = ref(false)

// Passar el focus d'una fletxa a l'altra també dispara focusout: només compta si el focus surt del carrusel
function onFocusOut(event) {
  if (!root.value?.contains(event.relatedTarget)) focused.value = false
}

let timer = null
const running = computed(() => canMove.value && !hovered.value && !focused.value && !pausedByUser.value)

function stop() {
  clearInterval(timer)
  timer = null
}

function start() {
  stop()
  if (running.value) timer = setInterval(() => go(index.value + 1), props.interval)
}

watch(running, start, { immediate: true })

function go(target) {
  index.value = (target + positions.value) % positions.value
}

// Amb les fletxes, el temporitzador torna a començar: la targeta no salta just després de prémer
function move(step) {
  go(index.value + step)
  start()
}

onBeforeUnmount(() => {
  stop()
  narrowQuery?.removeEventListener('change', onNarrowChange)
})

const titleId = useId()
</script>

<template>
  <section
    ref="root"
    class="market-feed"
    aria-roledescription="carrusel"
    :aria-labelledby="titleId"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="onFocusOut"
  >
    <header class="market-feed__head">
      <h2
        :id="titleId"
        class="eyebrow"
      >
        {{ label }}
      </h2>

      <div
        v-if="canMove"
        class="market-feed__controls"
      >
        <!-- Indicador de posició: només visual, cada targeta ja diu "N de M" -->
        <div
          class="market-feed__dots"
          aria-hidden="true"
        >
          <span
            v-for="n in positions"
            :key="n"
            class="market-feed__dot"
            :class="{ 'market-feed__dot--active': n - 1 === index }"
          />
        </div>
        <UiButton
          variant="secondary"
          size="sm"
          aria-label="Anterior"
          @click="move(-1)"
        >
          <span aria-hidden="true">‹</span>
        </UiButton>
        <UiButton
          variant="secondary"
          size="sm"
          :aria-label="pausedByUser ? 'Reprèn les targetes' : 'Atura les targetes'"
          @click="pausedByUser = !pausedByUser"
        >
          <span aria-hidden="true">{{ pausedByUser ? '▶' : '❚❚' }}</span>
          {{ pausedByUser ? 'Reprèn' : 'Atura' }}
        </UiButton>
        <UiButton
          variant="secondary"
          size="sm"
          aria-label="Següent"
          @click="move(1)"
        >
          <span aria-hidden="true">›</span>
        </UiButton>
      </div>
    </header>

    <div class="market-feed__viewport">
      <!-- Mentre avança sol, el lector de pantalla no anuncia cada canvi; quan està aturat, sí (WAI-ARIA) -->
      <div
        class="market-feed__track"
        :style="{ '--market-feed-index': index }"
        :aria-live="running ? 'off' : 'polite'"
      >
        <!-- Les targetes que no es veuen són inert: el tabulador no hi entra i el lector de pantalla no les llegeix.
             Amb undefined, Vue treu l'atribut: inert="false" també faria inert la targeta -->
        <div
          v-for="(item, i) in items"
          :key="item.id"
          class="market-feed__card"
          role="group"
          aria-roledescription="targeta"
          :aria-label="`${i + 1} de ${items.length}`"
          :inert="isVisible(i) ? undefined : true"
        >
          <slot
            name="item"
            :item="item"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.market-feed {
  /* Distància entre targetes i el que avança la pista a cada pas (targeta + separació) */
  --market-feed-gap: var(--tub-space-4);
  --market-feed-card: calc((100% - 3 * var(--market-feed-gap)) / 3.25);

  display: grid;
  gap: var(--tub-space-4);
}

.market-feed__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tub-space-4);
}

.market-feed__head h2 {
  margin: 0;
}

.market-feed__controls {
  display: flex;
  align-items: center;
  gap: var(--tub-space-2);
}

.market-feed__dots {
  display: flex;
  gap: var(--tub-space-1);
  margin-right: var(--tub-space-2);
}

.market-feed__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--tub-radius-pill);
  background: var(--tub-border-strong);
  transition: width var(--tub-duration) var(--tub-ease);
}

.market-feed__dot--active {
  width: 18px;
  background: var(--tub-primary);
}

.market-feed__viewport {
  overflow: hidden;
}

.market-feed__track {
  display: flex;
  gap: var(--market-feed-gap);
  transform: translateX(
    calc(var(--market-feed-index) * -1 * (var(--market-feed-card) + var(--market-feed-gap)))
  );
  transition: transform 0.4s var(--tub-ease);
}

.market-feed__card {
  flex: 0 0 var(--market-feed-card);
  min-width: 0;
  padding: var(--tub-space-5);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-lg);
  background: var(--tub-surface);
  box-shadow: var(--tub-shadow-sm);
}

@media (max-width: 900px) {
  .market-feed {
    --market-feed-card: 100%;
  }
}
</style>
