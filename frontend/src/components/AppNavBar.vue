<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { UiLogo } from './ui'

const links = [
  { to: '/actius', label: 'Actius' },
  { to: '/cartera', label: 'Cartera' },
  { to: '/historial', label: 'Historial' },
  { to: '/bustia', label: 'Bústia' },
  { to: '/compte-efectiu', label: "Compte d'efectiu" },
  { to: '/perfil', label: 'Perfil' },
]

const open = ref(false)
const route = useRoute()

// Tanca el menú mòbil en canviar de pàgina
watch(() => route.path, () => { open.value = false })
</script>

<template>
  <header class="navbar" :class="{ 'navbar--open': open }">
    <div class="navbar__inner">
      <UiLogo to="/actius" size="sm" />
      <button
        type="button"
        class="navbar__toggle"
        :aria-expanded="open"
        aria-controls="navbar-links"
        :aria-label="open ? 'Tancar el menú' : 'Obrir el menú'"
        @click="open = !open"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path v-if="open" d="M6 6l12 12M18 6L6 18" />
          <path v-else d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <nav id="navbar-links" class="navbar__links" aria-label="Navegació principal">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="navbar__link">
          {{ link.label }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--tub-surface);
  border-bottom: 1px solid var(--tub-border);
}
.navbar__inner {
  display: flex;
  align-items: center;
  gap: var(--tub-space-6);
  padding: 0 var(--tub-space-5);
  height: 64px;
}
.navbar__links {
  display: flex;
  flex: 1;
  height: 100%;
  gap: var(--tub-space-1);
}
/* Perfil a la dreta, com a la referència */
.navbar__link:last-child {
  margin-left: auto;
}
.navbar__link {
  display: flex;
  align-items: center;
  padding: 0 var(--tub-space-3);
  border-bottom: 2px solid transparent;
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
  font-weight: 600;
  white-space: nowrap;
}
.navbar__link:hover {
  color: var(--tub-text);
}
.navbar__link.router-link-active {
  color: var(--tub-primary-hover);
  border-bottom-color: var(--tub-primary);
}

.navbar__toggle {
  display: none;
  margin-left: auto;
  padding: var(--tub-space-2);
  border: 0;
  border-radius: var(--tub-radius-sm);
  background: transparent;
  color: var(--tub-text);
  cursor: pointer;
}
.navbar__toggle:hover {
  background: var(--tub-surface-2);
}
.navbar__toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--tub-ring);
}
.navbar__toggle svg {
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

/* Pantalles mitjanes: menys espai entre pestanyes */
@media (max-width: 1100px) {
  .navbar__inner {
    gap: var(--tub-space-4);
  }
  .navbar__link {
    padding: 0 var(--tub-space-2);
  }
}

/* Mòbil i tauleta: menú desplegable */
@media (max-width: 900px) {
  .navbar__inner {
    flex-wrap: wrap;
    gap: 0;
    height: auto;
    padding: 0 var(--tub-space-4);
  }
  .navbar__toggle {
    display: block;
    /* 40px + 2×8px = fila de 56px, oberta o tancada */
    margin-block: var(--tub-space-2);
  }
  .navbar__links {
    display: none;
    flex-basis: 100%;
    flex-direction: column;
    gap: 0;
    padding-bottom: var(--tub-space-3);
  }
  .navbar--open .navbar__links {
    display: flex;
  }
  .navbar__link,
  .navbar__link:last-child {
    margin-left: 0;
    padding: var(--tub-space-3);
    border-bottom: 0;
    border-radius: var(--tub-radius-sm);
    font-size: var(--tub-text-md);
  }
  .navbar__link.router-link-active {
    background: var(--tub-primary-soft);
  }
}
</style>
