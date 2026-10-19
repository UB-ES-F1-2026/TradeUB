<script setup>
import { ref } from 'vue'
import { UiButton, UiInput, UiCard, UiAlert, UiBadge, UiLogo } from '../components/ui'

const text = ref('')
const bad = ref('hola')
const groups = [
  { name: 'Marca', tokens: ['navy', 'navy-2', 'navy-3', 'green', 'green-dark', 'green-light', 'green-soft'] },
  { name: 'Text i superfícies', tokens: ['text', 'text-2', 'text-muted', 'bg', 'surface', 'surface-2', 'border'] },
  { name: 'Estats', tokens: ['danger', 'success-text', 'info-text', 'warning-text'] },
]
</script>

<template>
  <div class="sg">
    <header class="sg__head">
      <UiLogo size="lg" />
      <p class="sg__intro">
        Guia d'estil de TradeUB. Font de veritat:
        <code>src/styles/tokens.css</code> i <code>src/components/ui/</code>.
      </p>
    </header>

    <section class="sg__section">
      <p class="eyebrow">
        01
      </p>
      <h2>Colors</h2>
      <div
        v-for="g in groups"
        :key="g.name"
        class="sg__group"
      >
        <p class="sg__group-name">
          {{ g.name }}
        </p>
        <div class="sg__swatches">
          <div
            v-for="t in g.tokens"
            :key="t"
            class="sg__swatch"
          >
            <span
              class="sg__chip"
              :style="{ background: `var(--tub-${t})` }"
            />
            <code>--tub-{{ t }}</code>
          </div>
        </div>
      </div>
    </section>

    <section class="sg__section">
      <p class="eyebrow">
        02
      </p>
      <h2>Tipografia</h2>
      <div class="sg__type">
        <h1 class="sg__h1">
          Comença a invertir amb diners simulats.
        </h1>
        <p class="sg__lead">
          Titulars amb <code>--tub-font-display</code>, cos amb <code>--tub-font</code>, preus amb <code>.tabular</code>.
        </p>
        <p class="tabular sg__num">
          10.482,35 € <UiBadge variant="success">
            +4,82 %
          </UiBadge>
        </p>
      </div>
    </section>

    <section class="sg__section">
      <p class="eyebrow">
        03
      </p>
      <h2>Botons</h2>
      <div class="sg__row">
        <UiButton>Primary</UiButton>
        <UiButton variant="secondary">
          Secondary
        </UiButton>
        <UiButton variant="ghost">
          Ghost
        </UiButton>
        <UiButton loading>
          Carregant
        </UiButton>
        <UiButton disabled>
          Disabled
        </UiButton>
      </div>
      <div class="sg__row">
        <UiButton size="sm">
          Petit
        </UiButton>
        <UiButton size="md">
          Mitjà
        </UiButton>
        <UiButton size="lg">
          Gran
        </UiButton>
      </div>
    </section>

    <section class="sg__section">
      <p class="eyebrow">
        04
      </p>
      <h2>Badges</h2>
      <div class="sg__row">
        <UiBadge>Neutral</UiBadge>
        <UiBadge variant="success">
          +4,82 %
        </UiBadge>
        <UiBadge variant="danger">
          −1,20 %
        </UiBadge>
        <UiBadge variant="info">
          ETF
        </UiBadge>
      </div>
    </section>

    <section class="sg__section">
      <p class="eyebrow">
        05
      </p>
      <h2>Formulari</h2>
      <UiCard class="sg__card">
        <h3 class="sg__card-title">
          Crea el teu compte
        </h3>
        <p class="sg__card-sub">
          Només et portarà un minut.
        </p>
        <UiInput
          v-model="text"
          label="Correu electrònic"
          type="email"
          placeholder="nom@exemple.com"
          hint="Fes servir el correu de la UB."
        />
        <UiInput
          v-model="bad"
          label="Contrasenya"
          error="La contrasenya no compleix els requisits."
        >
          <template #trailing>
            <UiButton
              variant="ghost"
              size="sm"
            >
              Mostrar
            </UiButton>
          </template>
        </UiInput>
        <UiButton
          type="submit"
          size="lg"
          block
        >
          Crear compte
        </UiButton>
      </UiCard>
    </section>

    <section class="sg__section">
      <p class="eyebrow">
        06
      </p>
      <h2>Alertes</h2>
      <div class="sg__alerts">
        <UiAlert variant="info">
          Hem enviat un enllaç de verificació al teu correu.
        </UiAlert>
        <UiAlert variant="success">
          Correu reenviat. Revisa també la carpeta de correu brossa.
        </UiAlert>
        <UiAlert variant="warning">
          La sessió caducarà d'aquí a 5 minuts.
        </UiAlert>
        <UiAlert variant="error">
          Aquest correu ja està registrat.
        </UiAlert>
      </div>
    </section>

    <section class="sg__section">
      <p class="eyebrow">
        07
      </p>
      <h2>Panell de marca</h2>
      <div class="sg__brand tub-on-dark">
        <UiLogo />
        <h3 class="sg__brand-title">
          Practica amb accions i ETFs<br>sense risc.
        </h3>
        <div class="sg__row">
          <UiBadge variant="on-dark">
            +4,82 %
          </UiBadge>
          <UiBadge variant="danger">
            −1,20 %
          </UiBadge>
        </div>
        <p class="sg__brand-lead">
          Fons <code>--tub-gradient-brand</code>, text <code>--tub-text-on-dark*</code>, cards <code>variant="glass"</code>.
        </p>
        <UiCard
          variant="glass"
          padding="md"
          class="sg__glass"
        >
          <div class="sg__glass-head">
            <div>
              <span class="sg__glass-label">Cartera simulada</span>
              <strong class="tabular sg__glass-value">10.482,35 €</strong>
            </div>
            <UiBadge variant="on-dark">
              +4,82 %
            </UiBadge>
          </div>
          <svg
            viewBox="0 0 300 80"
            preserveAspectRatio="none"
            class="sg__chart"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="sg-fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stop-color="#34d399"
                  stop-opacity="0.35"
                />
                <stop
                  offset="100%"
                  stop-color="#34d399"
                  stop-opacity="0"
                />
              </linearGradient>
            </defs>
            <path
              d="M0 62 L30 56 L60 60 L90 44 L120 48 L150 34 L180 40 L210 24 L240 28 L270 12 L300 16 L300 80 L0 80 Z"
              fill="url(#sg-fill)"
            />
            <path
              d="M0 62 L30 56 L60 60 L90 44 L120 48 L150 34 L180 40 L210 24 L240 28 L270 12 L300 16"
              fill="none"
              stroke="#34d399"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
        </UiCard>
        <div class="sg__row">
          <UiButton>Comença ara</UiButton>
          <UiButton variant="dark">
            Saber-ne més
          </UiButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sg {
  max-width: 920px;
  margin: 0 auto;
  padding: var(--tub-space-8) var(--tub-space-4) var(--tub-space-8);
  display: grid;
  gap: var(--tub-space-8);
}
.sg__head {
  display: grid;
  gap: var(--tub-space-3);
}
.sg__intro {
  color: var(--tub-text-muted);
  max-width: 560px;
}
code {
  font-family: var(--tub-font-mono);
  font-size: 0.85em;
  padding: 0.1em 0.4em;
  border-radius: 6px;
  background: var(--tub-surface-2);
  color: var(--tub-text-2);
}
.sg__section {
  display: grid;
  gap: var(--tub-space-4);
}
.sg__section h2 {
  font-size: var(--tub-text-xl);
  margin-top: calc(-1 * var(--tub-space-2));
}
.sg__group {
  display: grid;
  gap: var(--tub-space-2);
}
.sg__group-name {
  font-size: var(--tub-text-sm);
  font-weight: 600;
  color: var(--tub-text-2);
}
.sg__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--tub-space-3);
}
.sg__swatch {
  display: flex;
  align-items: center;
  gap: var(--tub-space-2);
}
.sg__swatch code {
  background: transparent;
  padding: 0;
  color: var(--tub-text-muted);
}
.sg__chip {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}
.sg__type {
  display: grid;
  gap: var(--tub-space-3);
}
.sg__h1 {
  font-size: var(--tub-text-2xl);
  max-width: 560px;
}
.sg__lead {
  color: var(--tub-text-muted);
  max-width: 560px;
}
.sg__num {
  display: flex;
  align-items: center;
  gap: var(--tub-space-3);
  font-size: var(--tub-text-xl);
  font-weight: 700;
}
.sg__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
  align-items: center;
}
.sg__card {
  max-width: 460px;
}
.sg__card-title {
  font-size: var(--tub-text-xl);
}
.sg__card-sub {
  color: var(--tub-text-muted);
  margin: var(--tub-space-1) 0 var(--tub-space-5);
}
.sg__alerts {
  max-width: 560px;
}
.sg__alerts > * {
  margin-bottom: var(--tub-space-3);
}
.sg__brand {
  display: grid;
  gap: var(--tub-space-5);
  padding: var(--tub-space-7) var(--tub-space-8);
  border-radius: var(--tub-radius-xl);
  background: var(--tub-gradient-brand);
  color: var(--tub-text-on-dark);
}
.sg__brand-title {
  font-size: var(--tub-text-2xl);
}
.sg__brand-lead {
  color: var(--tub-text-on-dark-muted);
  max-width: 520px;
}
.sg__brand code {
  background: var(--tub-surface-on-dark);
  color: var(--tub-text-on-dark);
}
.sg__glass {
  max-width: 420px;
}
.sg__glass-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--tub-space-2);
}
.sg__glass-label {
  display: block;
  font-size: var(--tub-text-xs);
  color: var(--tub-text-on-dark-faint);
}
.sg__glass-value {
  font-size: 1.5rem;
}
.sg__chart {
  display: block;
  width: 100%;
  height: 80px;
}
@media (max-width: 640px) {
  .sg__brand {
    padding: var(--tub-space-5) var(--tub-space-4);
  }
}
</style>
