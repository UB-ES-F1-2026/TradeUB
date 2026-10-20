<script setup>
defineProps({
  to: { type: String, default: '/' },
  size: { type: String, default: 'md' }, // sm | md | lg
  markOnly: { type: Boolean, default: false },
})
</script>

<template>
  <RouterLink
    :to="to"
    class="ui-logo"
    :class="`ui-logo--${size}`"
    aria-label="TradeUB"
  >
    <!-- Logotip oficial (public/brand). La versió blanca s'activa dins de .tub-on-dark (regla a base.css) -->
    <template v-if="markOnly">
      <img
        class="ui-logo__img"
        src="/brand/mark.svg"
        alt=""
      >
    </template>
    <template v-else>
      <img
        class="ui-logo__img ui-logo__img--light"
        src="/brand/logo.svg"
        alt=""
      >
      <img
        class="ui-logo__img ui-logo__img--dark"
        src="/brand/logo-white.svg"
        alt=""
      >
    </template>
  </RouterLink>
</template>

<style scoped>
.ui-logo {
  display: inline-flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
  --h: 36px;
}
.ui-logo:hover {
  color: inherit;
}
.ui-logo--sm { --h: 28px; }
.ui-logo--lg { --h: 48px; }

/* Imatge oficial */
.ui-logo__img {
  display: block;
  height: var(--h);
  width: auto;
}
.ui-logo__img--dark {
  display: none;
}
/* El canvi de variant segons context (.tub-on-dark) és a base.css */
</style>
