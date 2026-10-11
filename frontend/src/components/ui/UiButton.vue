<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | dark
  size: { type: String, default: 'md' }, // sm | md | lg
  type: { type: String, default: 'button' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
})
</script>

<template>
  <button
    :type="type"
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'ui-btn--block': block }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="ui-btn__spinner" aria-hidden="true"></span>
    <span class="ui-btn__label"><slot /></span>
  </button>
</template>

<style scoped>
.ui-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--tub-space-2);
  border: 1px solid transparent;
  border-radius: var(--tub-radius-md);
  font-weight: 600;
  letter-spacing: -0.005em;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--tub-duration) var(--tub-ease),
    box-shadow var(--tub-duration) var(--tub-ease),
    transform var(--tub-duration) var(--tub-ease),
    border-color var(--tub-duration) var(--tub-ease);
}
.ui-btn--sm {
  padding: 0.45rem 0.8rem;
  font-size: var(--tub-text-sm);
  border-radius: var(--tub-radius-sm);
}
.ui-btn--md {
  padding: 0.78rem 1.15rem;
  font-size: var(--tub-text-md);
}
.ui-btn--lg {
  padding: 0.95rem 1.4rem;
  font-size: 1.05rem;
}
.ui-btn--block {
  width: 100%;
}
.ui-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.ui-btn:active:not(:disabled) {
  transform: translateY(0);
  transition-duration: 0.06s;
}
.ui-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.ui-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--tub-ring);
}

/* Primary: degradat verd amb brillantor interior i ombra de color */
.ui-btn--primary {
  color: var(--tub-primary-contrast);
  background: var(--tub-gradient-primary);
  box-shadow: var(--tub-shadow-primary);
}
.ui-btn--primary:hover:not(:disabled) {
  box-shadow: var(--tub-shadow-primary-hover);
}

/* Secondary: superfície amb vora i ombra mínima */
.ui-btn--secondary {
  color: var(--tub-text);
  background: var(--tub-surface);
  border-color: var(--tub-border);
  box-shadow: var(--tub-shadow-sm);
}
.ui-btn--secondary:hover:not(:disabled) {
  border-color: var(--tub-border-strong);
  box-shadow: var(--tub-shadow-md);
}

/* Ghost: text verd, fons només al hover */
.ui-btn--ghost {
  color: var(--tub-primary-hover);
  background: transparent;
}
.ui-btn--ghost:hover:not(:disabled) {
  background: var(--tub-primary-soft);
  transform: none;
}

/* Dark: per a panells de marca */
.ui-btn--dark {
  color: var(--tub-text-on-dark);
  background: var(--tub-surface-on-dark);
  border-color: var(--tub-border-on-dark);
  backdrop-filter: blur(6px);
}
.ui-btn--dark:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.ui-btn__spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(128, 128, 128, 0.35);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: ui-spin 0.7s linear infinite;
}
@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
