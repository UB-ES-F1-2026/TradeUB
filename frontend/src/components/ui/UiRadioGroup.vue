<script setup>
defineProps({
  options: { type: Array, required: true }, // [{ id, label }]
  name: { type: String, required: true },
  label: { type: String, default: '' }, // nom accessible del grup si no hi ha un <legend> a fora
})
const model = defineModel({ type: String, default: '' })
</script>

<template>
  <div
    class="ui-radio-group"
    role="radiogroup"
    :aria-label="label || undefined"
  >
    <label
      v-for="option in options"
      :key="option.id"
      class="ui-radio"
      :class="{ 'ui-radio--selected': model === option.id }"
    >
      <input
        v-model="model"
        type="radio"
        class="ui-radio__input"
        :name="name"
        :value="option.id"
      >
      <span>{{ option.label }}</span>
    </label>
  </div>
</template>

<style scoped>
.ui-radio-group {
  display: grid;
  gap: var(--tub-space-2);
}
.ui-radio {
  display: flex;
  align-items: center;
  gap: var(--tub-space-3);
  padding: var(--tub-space-3) var(--tub-space-4);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface);
  color: var(--tub-text-2);
  cursor: pointer;
  transition:
    border-color var(--tub-duration) var(--tub-ease),
    background var(--tub-duration) var(--tub-ease);
}
.ui-radio:hover {
  background: var(--tub-surface-hover);
}
.ui-radio--selected {
  border-color: var(--tub-primary);
  background: var(--tub-primary-soft);
  color: var(--tub-text);
}
.ui-radio:focus-within {
  box-shadow: 0 0 0 4px var(--tub-ring);
}
.ui-radio__input {
  flex: none;
  margin: 0;
  accent-color: var(--tub-primary);
}
</style>
