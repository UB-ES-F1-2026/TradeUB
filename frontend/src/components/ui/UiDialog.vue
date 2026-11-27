<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

// Diàleg modal comú (US6.5): <dialog> natiu amb showModal, que bloqueja la resta de la pàgina, manté el focus a dins
// i tanca amb Esc. El pare decideix si es tanca: Esc i "×" només emeten "close", i el pare posa open a false (així
// pot no tancar-lo mentre s'envia una operació). En obrir-se, el focus va al primer element que el rep; en tancar-se,
// torna on era. És la base de PinDialog i del detall d'una operació
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  size: { type: String, default: 'md' }, // sm (uns 420 px, el PIN) | md (uns 480 px, el detall)
  // Botó "×" a la capçalera
  closable: { type: Boolean, default: true },
})
const emit = defineEmits(['close'])

const dialog = ref(null)
const body = ref(null)
const titleId = useId()
// Element que tenia el focus abans d'obrir el diàleg, per tornar-l'hi en tancar-lo
let opener = null

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

async function show() {
  opener = document.activeElement
  await nextTick()
  // jsdom (tests) no implementa showModal: llavors el contingut es mostra igualment perquè depèn d'`open`
  if (dialog.value?.showModal && !dialog.value.open) dialog.value.showModal()
  body.value?.querySelector(FOCUSABLE)?.focus()
}

function hide() {
  if (dialog.value?.open) dialog.value.close()
  // Si l'element ja no és a la pàgina (per exemple, una fila que s'ha tornat a pintar), no es pot tornar a enfocar
  if (opener?.isConnected) opener.focus()
  opener = null
}

watch(() => props.open, (open) => (open ? show() : hide()), { immediate: true })
onBeforeUnmount(() => {
  if (props.open) hide()
})

// Esc dispara `cancel` al <dialog>: es demana al pare que el tanqui, però no es tanca sol
function onNativeCancel(event) {
  event.preventDefault()
  emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="ui-dialog"
    :class="`ui-dialog--${size}`"
    :aria-labelledby="titleId"
    @cancel="onNativeCancel"
  >
    <div
      v-if="open"
      ref="body"
      class="ui-dialog__body"
      data-test="ui-dialog"
    >
      <header class="ui-dialog__head">
        <h2
          :id="titleId"
          class="ui-dialog__title"
        >
          {{ title }}
        </h2>
        <button
          v-if="closable"
          type="button"
          class="ui-dialog__close"
          aria-label="Tanca"
          data-test="ui-dialog-close"
          @click="emit('close')"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <slot />
      <div
        v-if="$slots.footer"
        class="ui-dialog__footer"
      >
        <slot name="footer" />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.ui-dialog {
  width: min(480px, calc(100vw - 2 * var(--tub-space-4)));
  max-height: calc(100vh - 2 * var(--tub-space-4));
  padding: var(--tub-space-5);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-lg);
  background: var(--tub-surface);
  color: var(--tub-text);
  box-shadow: var(--tub-shadow-md);
}
.ui-dialog--sm {
  width: min(420px, calc(100vw - 2 * var(--tub-space-4)));
}
.ui-dialog::backdrop {
  background: var(--tub-overlay);
}
.ui-dialog__body {
  display: grid;
  gap: var(--tub-space-4);
}
.ui-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tub-space-3);
}
.ui-dialog__title {
  font-size: var(--tub-text-lg);
  font-weight: 600;
}
.ui-dialog__close {
  flex: none;
  width: 32px;
  height: 32px;
  margin: calc(-1 * var(--tub-space-1)) calc(-1 * var(--tub-space-2)) 0 0;
  border: 0;
  border-radius: var(--tub-radius-sm);
  background: none;
  color: var(--tub-text-muted);
  font-size: var(--tub-text-xl);
  line-height: 1;
  cursor: pointer;
}
.ui-dialog__close:hover {
  background: var(--tub-surface-2);
  color: var(--tub-text);
}
.ui-dialog__close:focus-visible {
  outline: 2px solid var(--tub-primary);
  outline-offset: 2px;
}
.ui-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}
</style>
