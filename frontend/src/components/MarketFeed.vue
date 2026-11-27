<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import UiButton from './ui/UiButton.vue'

// Cinta de targetes (US17.1) que es desplaça de manera contínua. No sap què hi ha a cada targeta: el contingut
// arriba pel slot "item". Els avisos de preu (US17.1) i els titulars (US17.2) la fan servir igual
const props = defineProps({
  items: { type: Array, required: true }, // [{ id, ... }]
  label: { type: String, required: true },
  // Ritme: el temps que triga a passar l'amplada d'una targeta
  secondsPerCard: { type: Number, default: 6 },
})

// Diu si es compleix una media query i s'actualitza quan canvia. jsdom (tests) no té matchMedia
function useMediaQuery(query) {
  const list = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  const matches = ref(list?.matches ?? false)
  const onChange = (event) => {
    matches.value = event.matches
  }
  list?.addEventListener('change', onChange)
  onBeforeUnmount(() => list?.removeEventListener('change', onChange))
  return matches
}

// Mateix punt de tall que el CSS: a escriptori hi caben tres targetes i un tros de la quarta; a 900 px o menys, una
// i un tros de la següent
const narrow = useMediaQuery('(max-width: 900px)')
// C5: si el sistema demana reduir el moviment, la cinta no es mou sola: es passa amb el desplaçament horitzontal
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

// Si totes les targetes hi caben, no cal moure res
const canMove = computed(() => props.items.length > (narrow.value ? 1 : 3))
const animated = computed(() => canMove.value && !reducedMotion.value)

// Tres pauses independents (C4): el ratolí a sobre, el focus del teclat dins, i el botó "Atura", que es manté fins
// que es prem "Reprèn". Només es mou si no n'hi ha cap
const root = ref(null)
const viewport = ref(null)
const hovered = ref(false)
const focused = ref(false)
const pausedByUser = ref(false)

// Un clic amb el ratolí també dona el focus: només compta el del teclat (:focus-visible). jsdom no sempre entén
// aquest selector; llavors es compta com a focus del teclat
function isKeyboardFocus(element) {
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}

function onFocusIn(event) {
  if (isKeyboardFocus(event.target)) focused.value = true
}

// Passar el focus d'un element a un altre de dins també dispara focusout: només compta si el focus surt de la cinta
function onFocusOut(event) {
  if (!root.value?.contains(event.relatedTarget)) focused.value = false
}

const running = computed(() => animated.value && !hovered.value && !focused.value && !pausedByUser.value)

// La cinta és una tira amb desplaçament horitzontal: a cada fotograma se suma una mica a scrollLeft. Les targetes hi
// són dues vegades; quan la primera còpia ha passat sencera, es torna enrere aquesta amplada i no es nota el salt.
// La posició es guarda a part perquè el navegador arrodoneix scrollLeft i, a menys d'1 px per fotograma, no
// avançaria mai
let frame = null
let lastTime = null
let position = 0

// Amplada d'una còpia de la llista: on comença la primera targeta repetida
function loopWidth() {
  const copy = viewport.value?.querySelector('[data-copy]')
  return copy ? copy.offsetLeft - viewport.value.firstElementChild.offsetLeft : 0
}

function tick(now) {
  const el = viewport.value
  if (el && lastTime !== null) {
    const loop = loopWidth()
    // Si l'usuari ha desplaçat la tira (trackpad, dit), es continua des d'on l'ha deixada
    if (Math.abs(el.scrollLeft - position) > 1) position = el.scrollLeft
    // Una pestanya amagada no rep fotogrames: en tornar, no s'avança tot el temps perdut de cop
    const seconds = Math.min(now - lastTime, 100) / 1000
    position += (seconds * loop) / props.items.length / props.secondsPerCard
    if (loop > 0 && position >= loop) position -= loop
    el.scrollLeft = position
  }
  lastTime = now
  frame = requestAnimationFrame(tick)
}

function stop() {
  cancelAnimationFrame(frame)
  frame = null
}

function start() {
  stop()
  if (!running.value) return
  lastTime = null
  position = viewport.value?.scrollLeft ?? 0
  frame = requestAnimationFrame(tick)
}

// flush 'post': quan running canvia, la còpia de les targetes ja és (o ja no és) al DOM
watch(running, start, { flush: 'post' })
onMounted(start)
onBeforeUnmount(stop)

const titleId = useId()
</script>

<template>
  <section
    ref="root"
    class="market-feed"
    aria-roledescription="carrusel"
    :aria-labelledby="titleId"
    :data-state="running ? 'running' : 'paused'"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <header class="market-feed__head">
      <h2
        :id="titleId"
        class="eyebrow"
      >
        {{ label }}
      </h2>

      <!-- Amb moviment reduït no es mou sola: no hi ha res a aturar -->
      <UiButton
        v-if="animated"
        variant="secondary"
        size="sm"
        :aria-label="pausedByUser ? 'Reprèn les targetes' : 'Atura les targetes'"
        @click="pausedByUser = !pausedByUser"
      >
        <span aria-hidden="true">{{ pausedByUser ? '▶' : '❚❚' }}</span>
        {{ pausedByUser ? 'Reprèn' : 'Atura' }}
      </UiButton>
    </header>

    <!-- Focusable perquè amb el teclat es pugui desplaçar amb les fletxes del teclat (i, en entrar-hi, s'atura) -->
    <div
      ref="viewport"
      class="market-feed__viewport"
      :class="{ 'market-feed__viewport--manual': !animated }"
      :tabindex="canMove ? 0 : undefined"
      role="group"
      :aria-labelledby="titleId"
    >
      <div
        v-for="(item, i) in items"
        :key="item.id"
        class="market-feed__card"
        role="group"
        aria-roledescription="targeta"
        :aria-label="`${i + 1} de ${items.length}`"
      >
        <slot
          name="item"
          :item="item"
        />
      </div>
      <!-- Còpia per al bucle: el lector de pantalla no la llegeix i el tabulador no hi entra -->
      <template v-if="animated">
        <div
          v-for="item in items"
          :key="`copy-${item.id}`"
          class="market-feed__card"
          data-copy
          aria-hidden="true"
          inert
        >
          <slot
            name="item"
            :item="item"
          />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.market-feed {
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

.market-feed__viewport {
  display: flex;
  gap: var(--market-feed-gap);
  overflow-x: auto;
  /* Mentre es mou sola, sense barra de desplaçament */
  scrollbar-width: none;
}

.market-feed__viewport::-webkit-scrollbar {
  display: none;
}

/* Sense moviment: es desplaça a mà, amb la barra visible i encaixant a cada targeta */
.market-feed__viewport--manual {
  padding-bottom: var(--tub-space-2);
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}

.market-feed__viewport--manual::-webkit-scrollbar {
  display: block;
  height: 6px;
}

.market-feed__viewport:focus-visible {
  outline: 2px solid var(--tub-primary);
  outline-offset: 4px;
  border-radius: var(--tub-radius-lg);
}

.market-feed__card {
  flex: 0 0 var(--market-feed-card);
  min-width: 0;
  padding: var(--tub-space-5);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-lg);
  background: var(--tub-surface);
  box-shadow: var(--tub-shadow-sm);
  scroll-snap-align: start;
}

@media (max-width: 900px) {
  .market-feed {
    --market-feed-card: 85%;
  }
}
</style>
