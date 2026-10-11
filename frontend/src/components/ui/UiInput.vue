<script setup>
import { useId } from 'vue'

defineProps({
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
})
defineOptions({ inheritAttrs: false })
const model = defineModel({ type: String, default: '' })
const id = useId()
</script>

<template>
  <div class="ui-field" :class="{ 'ui-field--invalid': error }">
    <label v-if="label" :for="id" class="ui-field__label">{{ label }}</label>
    <div class="ui-field__wrap">
      <input
        :id="id"
        v-model="model"
        :type="type"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        class="ui-field__input"
        :class="{ 'ui-field__input--trailing': $slots.trailing }"
        v-bind="$attrs"
      />
      <div v-if="$slots.trailing" class="ui-field__trailing">
        <slot name="trailing" />
      </div>
    </div>
    <small v-if="error" class="ui-field__error">{{ error }}</small>
    <small v-else-if="hint" class="ui-field__hint">{{ hint }}</small>
    <slot />
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
.ui-field__input {
  width: 100%;
  padding: 0.74rem 0.95rem;
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface);
  color: var(--tub-text);
  font-size: var(--tub-text-md);
  box-shadow: var(--tub-shadow-sm);
  transition:
    border-color var(--tub-duration) var(--tub-ease),
    box-shadow var(--tub-duration) var(--tub-ease);
}
.ui-field__input::placeholder {
  color: var(--tub-text-placeholder);
}
.ui-field__input--trailing {
  padding-right: 5rem;
}
.ui-field__input:hover:not(:focus) {
  border-color: var(--tub-border-strong);
}
.ui-field__input:focus {
  outline: none;
  border-color: var(--tub-primary);
  box-shadow: 0 0 0 4px var(--tub-ring);
}
.ui-field--invalid .ui-field__input {
  border-color: var(--tub-danger);
}
.ui-field--invalid .ui-field__input:focus {
  box-shadow: 0 0 0 4px var(--tub-ring-danger);
}
.ui-field__trailing {
  position: absolute;
  top: 50%;
  right: 0.4rem;
  transform: translateY(-50%);
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
