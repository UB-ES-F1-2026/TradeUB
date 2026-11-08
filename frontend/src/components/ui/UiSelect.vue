<script setup>
import { useId } from 'vue'

defineProps({
  label: { type: String, default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  placeholder: { type: String, default: 'Selecciona una opció' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
})
defineOptions({ inheritAttrs: false })
const model = defineModel({ type: String, default: '' })
const id = useId()
</script>

<template>
  <div
    class="ui-field"
    :class="{ 'ui-field--invalid': error }"
  >
    <label
      v-if="label"
      :for="id"
      class="ui-field__label"
    >{{ label }}</label>
    <div class="ui-field__wrap">
      <select
        :id="id"
        v-model="model"
        class="ui-field__select"
        :class="{ 'ui-field__select--empty': !model }"
        v-bind="$attrs"
      >
        <option
          value=""
          disabled
        >
          {{ placeholder }}
        </option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>
    <small
      v-if="error"
      class="ui-field__error"
    >{{ error }}</small>
    <small
      v-else-if="hint"
      class="ui-field__hint"
    >{{ hint }}</small>
  </div>
</template>

<style scoped>
.ui-field {
  margin-bottom: 1.1rem;
}
.ui-field__label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: var(--tub-text-sm);
  font-weight: 600;
  color: var(--tub-text-2);
}
.ui-field__wrap {
  position: relative;
}
/* Fletxa del desplegable amb vores i tokens (sense imatges ni colors a mà) */
.ui-field__wrap::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 1.1rem;
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid var(--tub-text-muted);
  border-bottom: 2px solid var(--tub-text-muted);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
.ui-field__select {
  appearance: none;
  width: 100%;
  padding: 0.74rem 2.4rem 0.74rem 0.95rem;
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface);
  color: var(--tub-text);
  font-size: var(--tub-text-md);
  box-shadow: var(--tub-shadow-sm);
  cursor: pointer;
  transition:
    border-color var(--tub-duration) var(--tub-ease),
    box-shadow var(--tub-duration) var(--tub-ease);
}
.ui-field__select--empty {
  color: var(--tub-text-placeholder);
}
.ui-field__select:hover:not(:focus) {
  border-color: var(--tub-border-strong);
}
.ui-field__select:focus {
  outline: none;
  border-color: var(--tub-primary);
  box-shadow: 0 0 0 4px var(--tub-ring);
}
.ui-field--invalid .ui-field__select {
  border-color: var(--tub-danger);
}
.ui-field--invalid .ui-field__select:focus {
  box-shadow: 0 0 0 4px var(--tub-ring-danger);
}
.ui-field__error,
.ui-field__hint {
  display: block;
  margin-top: 0.4rem;
  font-size: var(--tub-text-xs);
}
.ui-field__error {
  color: var(--tub-danger);
  font-weight: 500;
}
.ui-field__hint {
  color: var(--tub-text-muted);
}
</style>
