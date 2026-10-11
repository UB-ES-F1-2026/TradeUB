<script setup>
defineProps({
  variant: { type: String, default: 'info' }, // info | success | warning | error
})
</script>

<template>
  <div class="ui-alert" :class="`ui-alert--${variant}`" role="alert">
    <span class="ui-alert__icon" aria-hidden="true">
      <svg v-if="variant === 'success'" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10.5l3.2 3L15 7" /></svg>
      <svg v-else-if="variant === 'error'" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8" /></svg>
      <svg v-else-if="variant === 'warning'" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 5v6M10 14.5v.5" /></svg>
      <svg v-else viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 9v6M10 5.5v.5" /></svg>
    </span>
    <p class="ui-alert__body"><slot /></p>
  </div>
</template>

<style scoped>
.ui-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin: 0 0 var(--tub-space-4);
  padding: 0.75rem 0.9rem;
  border: 1px solid;
  border-radius: var(--tub-radius-md);
  box-shadow: var(--tub-shadow-sm);
  font-size: var(--tub-text-sm);
  line-height: 1.45;
}
.ui-alert__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 50%;
  background: currentColor;
}
.ui-alert__icon svg {
  width: 13px;
  height: 13px;
  color: var(--tub-surface);
}
.ui-alert__body {
  margin: 0;
}
.ui-alert--info {
  background: var(--tub-info-bg);
  color: var(--tub-info-text);
  border-color: var(--tub-info-border);
}
.ui-alert--success {
  background: var(--tub-success-bg);
  color: var(--tub-success-text);
  border-color: var(--tub-success-border);
}
.ui-alert--warning {
  background: var(--tub-warning-bg);
  color: var(--tub-warning-text);
  border-color: var(--tub-warning-border);
}
.ui-alert--error {
  background: var(--tub-danger-bg);
  color: var(--tub-danger-text);
  border-color: var(--tub-danger-border);
}
</style>
