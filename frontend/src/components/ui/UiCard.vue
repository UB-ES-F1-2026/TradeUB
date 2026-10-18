<script setup>
defineProps({
  variant: { type: String, default: 'default' }, // default | glass (sobre fons fosc)
  padding: { type: String, default: 'lg' }, // sm | md | lg
})
</script>

<template>
  <div
    class="ui-card"
    :class="[`ui-card--${variant}`, `ui-card--pad-${padding}`]"
  >
    <slot />
  </div>
</template>

<style scoped>
.ui-card {
  width: 100%;
  border-radius: var(--tub-radius-xl);
}
.ui-card--pad-sm {
  padding: var(--tub-space-4);
}
.ui-card--pad-md {
  padding: var(--tub-space-5);
}
.ui-card--pad-lg {
  padding: var(--tub-space-7) var(--tub-space-6);
}
.ui-card--default {
  background: var(--tub-surface);
  box-shadow: var(--tub-shadow-card);
}
.ui-card--glass {
  border: 1px solid var(--tub-border-on-dark);
  border-radius: var(--tub-radius-lg);
  background: var(--tub-surface-on-dark);
  color: var(--tub-text-on-dark);
  backdrop-filter: blur(8px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
</style>
