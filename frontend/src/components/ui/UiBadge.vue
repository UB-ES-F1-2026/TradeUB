<script setup>
defineProps({
  variant: { type: String, default: 'neutral' }, // neutral | success | danger | info | on-dark
})
</script>

<template>
  <span
    class="ui-badge tabular"
    :class="`ui-badge--${variant}`"
  ><slot /></span>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--tub-radius-pill);
  font-size: var(--tub-text-xs);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.ui-badge--neutral {
  background: var(--tub-surface-2);
  color: var(--tub-text-2);
}
.ui-badge--success {
  background: var(--tub-success-bg);
  color: var(--tub-success-text);
}
.ui-badge--danger {
  background: var(--tub-danger-bg);
  color: var(--tub-danger-text);
}
.ui-badge--info {
  background: var(--tub-info-bg);
  color: var(--tub-info-text);
}
.ui-badge--on-dark {
  background: rgba(52, 211, 153, 0.18);
  color: var(--tub-green-light);
}
</style>
