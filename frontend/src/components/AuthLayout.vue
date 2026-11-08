<script setup>
import { UiCard, UiLogo } from './ui'

defineProps({
  title: { type: String, required: true },
  lead: { type: String, default: '' },
  perks: { type: Array, default: () => [] },
})
</script>

<!--
  Layout comú de les pantalles d'accés (login, registre).
  Les columnes són fixes perquè la línia entre el panell de marca i el formulari
  no es mogui en canviar de pantalla. Cada panell fa scroll per dins, així la
  barra de desplaçament de la pàgina tampoc desplaça la línia.
-->
<template>
  <div class="auth-layout">
    <aside class="auth-layout__brand tub-on-dark">
      <UiLogo size="lg" />

      <div class="auth-layout__brand-body">
        <h2 class="auth-layout__title">
          {{ title }}
        </h2>
        <p
          v-if="lead"
          class="auth-layout__lead"
        >
          {{ lead }}
        </p>
        <ul
          v-if="perks.length"
          class="auth-layout__perks"
        >
          <li
            v-for="perk in perks"
            :key="perk"
          >
            <span class="auth-layout__tick">✓</span> {{ perk }}
          </li>
        </ul>
        <slot name="brand" />
      </div>
    </aside>

    <section class="auth-layout__panel">
      <div class="auth-layout__content">
        <div class="auth-layout__mobile-logo">
          <UiLogo />
        </div>
        <UiCard>
          <slot />
        </UiCard>
      </div>
    </section>
  </div>
</template>

<style scoped>
.auth-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  height: 100vh;
  overflow: hidden;
  text-align: left;
}

/* ---------- Panell de marca ---------- */
.auth-layout__brand {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--tub-space-6);
  padding: var(--tub-space-7) var(--tub-space-8);
  background: var(--tub-gradient-brand);
  overflow-y: auto;
}
.auth-layout__brand-body {
  display: grid;
  gap: var(--tub-space-5);
  align-content: center;
  max-width: 460px;
}
.auth-layout__title {
  font-size: var(--tub-text-2xl);
  line-height: 1.15;
}
.auth-layout__lead {
  color: var(--tub-text-on-dark-muted);
  line-height: 1.55;
}
.auth-layout__perks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--tub-space-3);
  color: var(--tub-text-on-dark-muted);
}
.auth-layout__tick {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-right: var(--tub-space-2);
  border-radius: var(--tub-radius-pill);
  background: var(--tub-surface-on-dark);
  color: var(--tub-green-light);
  font-size: var(--tub-text-xs);
  font-weight: 700;
}

/* ---------- Panell del formulari ---------- */
.auth-layout__panel {
  display: flex;
  padding: var(--tub-space-7) var(--tub-space-5);
  background: var(--tub-bg);
  overflow-y: auto;
}
/* margin: auto centra el contingut sense tallar-ne la part de dalt si és més alt que la pantalla */
.auth-layout__content {
  display: grid;
  gap: var(--tub-space-5);
  width: 100%;
  max-width: 440px;
  margin: auto;
}
.auth-layout__mobile-logo {
  display: none;
}

/* Per sota de 900px s'amaga el panell de marca i el logo passa a sobre del formulari */
@media (max-width: 900px) {
  .auth-layout {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .auth-layout__brand {
    display: none;
  }
  .auth-layout__panel {
    padding: var(--tub-space-6) var(--tub-space-4);
  }
  .auth-layout__mobile-logo {
    display: flex;
    justify-content: center;
  }
}
</style>
