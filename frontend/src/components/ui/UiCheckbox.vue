<script setup>
import { useId } from 'vue'

defineProps({
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
})
defineOptions({ inheritAttrs: false })
const model = defineModel({ type: Boolean, default: false })
const id = useId()
</script>

<template>
  <div
    class="ui-check"
    :class="{ 'ui-check--invalid': error, 'ui-check--disabled': disabled }"
  >
    <div class="ui-check__row">
      <input
        :id="id"
        v-model="model"
        type="checkbox"
        class="ui-check__input"
        :disabled="disabled"
        v-bind="$attrs"
      >
      <label
        :for="id"
        class="ui-check__label"
      ><slot>{{ label }}</slot></label>
    </div>
    <small
      v-if="error"
      class="ui-check__error"
    >{{ error }}</small>
    <small
      v-else-if="hint"
      class="ui-check__hint"
    >{{ hint }}</small>
  </div>
</template>

<style scoped>
.ui-check {
  margin-bottom: 1.1rem;
}
.ui-check__row {
  display: flex;
  align-items: flex-start;
  gap: var(--tub-space-3);
}
.ui-check__input {
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  margin: 0.15rem 0 0;
  accent-color: var(--tub-primary);
  cursor: pointer;
}
.ui-check__input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--tub-ring);
}
.ui-check__label {
  font-size: var(--tub-text-sm);
  color: var(--tub-text-2);
  cursor: pointer;
}
.ui-check--disabled .ui-check__input,
.ui-check--disabled .ui-check__label {
  cursor: not-allowed;
}
.ui-check--disabled .ui-check__label {
  color: var(--tub-text-muted);
}
.ui-check--invalid .ui-check__input:focus-visible {
  box-shadow: 0 0 0 4px var(--tub-ring-danger);
}
.ui-check__error,
.ui-check__hint {
  display: block;
  margin-top: 0.4rem;
  padding-left: calc(1.15rem + var(--tub-space-3));
  font-size: var(--tub-text-xs);
}
.ui-check__error {
  color: var(--tub-danger);
  font-weight: 500;
}
.ui-check__hint {
  color: var(--tub-text-muted);
}
</style>
