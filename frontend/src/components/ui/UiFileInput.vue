<script setup>
// Selector de fitxers. No desa el fitxer: l'emet a "change" i el pare decideix si l'accepta.
// L'input es buida després de cada selecció perquè es pugui tornar a triar el mateix fitxer
defineProps({
  label: { type: String, default: 'Selecciona un fitxer' },
  accept: { type: String, default: '' },
  fileName: { type: String, default: '' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
})
defineOptions({ inheritAttrs: false })
const emit = defineEmits(['change'])

function onChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) emit('change', file)
}
</script>

<template>
  <div
    class="ui-file"
    :class="{ 'ui-file--invalid': error }"
  >
    <label class="ui-file__zone">
      <input
        class="ui-file__input"
        type="file"
        :accept="accept"
        v-bind="$attrs"
        @change="onChange"
      >
      <slot />
      <span class="ui-file__label">{{ fileName || label }}</span>
      <small
        v-if="hint"
        class="ui-file__hint"
      >{{ hint }}</small>
    </label>
    <small
      v-if="error"
      class="ui-file__error"
    >{{ error }}</small>
  </div>
</template>

<style scoped>
.ui-file__zone {
  position: relative;
  display: grid;
  justify-items: center;
  gap: var(--tub-space-2);
  padding: var(--tub-space-5);
  border: 1px dashed var(--tub-border-strong);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface-hover);
  text-align: center;
  cursor: pointer;
  transition:
    border-color var(--tub-duration) var(--tub-ease),
    box-shadow var(--tub-duration) var(--tub-ease);
}
.ui-file__zone:hover {
  border-color: var(--tub-primary);
}
.ui-file__zone:focus-within {
  border-color: var(--tub-primary);
  box-shadow: 0 0 0 4px var(--tub-ring);
}
.ui-file--invalid .ui-file__zone {
  border-color: var(--tub-danger);
}
.ui-file--invalid .ui-file__zone:focus-within {
  box-shadow: 0 0 0 4px var(--tub-ring-danger);
}
/* L'input cobreix tota la zona: es pot clicar a qualsevol lloc i continua sent accessible amb el teclat */
.ui-file__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.ui-file__label {
  font-weight: 600;
  color: var(--tub-text);
  overflow-wrap: anywhere;
}
.ui-file__hint,
.ui-file__error {
  display: block;
  font-size: var(--tub-text-xs);
}
.ui-file__hint {
  color: var(--tub-text-muted);
}
.ui-file__error {
  margin-top: 0.4rem;
  color: var(--tub-danger);
  font-weight: 500;
}
</style>
