<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../stores/auth'
import { UiButton, UiInput, UiCard, UiAlert, UiBadge, UiLogo } from '../components/ui'
import { getPasswordRules, isPasswordValid } from '../utils/passwordRules'

const authStore = useAuthStore()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = ref('')
const emailConfirm = ref('')
const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)

const loading = ref(false)
const submitted = ref(false)
const error = ref('')
const info = ref('')
const sent = ref(false)
const cooldown = ref(0)
let timer = null

const normalizedEmail = computed(() => email.value.trim().toLowerCase())
const emailValid = computed(() => EMAIL_RE.test(normalizedEmail.value))
const emailsMatch = computed(
  () => emailConfirm.value.trim().toLowerCase() === normalizedEmail.value
)

const rules = computed(() => getPasswordRules(password.value))
const passwordValid = computed(() => isPasswordValid(password.value))
const passwordsMatch = computed(() => password.value === passwordConfirm.value)

const errors = computed(() => ({
  email: submitted.value && !emailValid.value ? 'Introdueix un correu vàlid.' : '',
  emailConfirm:
    (submitted.value || emailConfirm.value) && !emailsMatch.value
      ? 'Els correus no coincideixen.'
      : '',
  password:
    submitted.value && !passwordValid.value
      ? 'La contrasenya no compleix els requisits.'
      : '',
  passwordConfirm:
    (submitted.value || passwordConfirm.value) && !passwordsMatch.value
      ? 'Les contrasenyes no coincideixen.'
      : '',
}))

const formValid = computed(
  () =>
    emailValid.value &&
    emailsMatch.value &&
    passwordValid.value &&
    passwordsMatch.value
)

function startCooldown() {
  cooldown.value = 60
  clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value--
    if (cooldown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function handleSubmit() {
  submitted.value = true
  error.value = ''
  info.value = ''
  if (!formValid.value) return

  loading.value = true
  try {
    const data = await authStore.register(normalizedEmail.value, password.value)
    // Si el correu ja existeix, Supabase no dona error: retorna un usuari sense identities
    if (data.user && data.user.identities?.length === 0) {
      error.value = 'Aquest correu ja està registrat.'
      return
    }
    sent.value = true
    startCooldown()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function resend() {
  if (cooldown.value > 0) return
  error.value = ''
  info.value = ''
  try {
    await authStore.resend(normalizedEmail.value)
    info.value = 'Correu reenviat. Revisa també la carpeta de correu brossa.'
    startCooldown()
  } catch (err) {
    error.value = err.message
  }
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="page">
    <!-- Panell de marca -->
    <aside class="brand tub-on-dark">
      <UiLogo />

      <div class="brand-body">
        <h1>Comença a invertir<br>amb diners simulats.</h1>
        <p class="lead">
          Practica amb accions i ETFs sense risc. Una plataforma pensada per
          aprendre a invertir pas a pas.
        </p>

        <ul class="perks">
          <li><span class="tick">✓</span> Compte gratuït i sense compromís</li>
          <li><span class="tick">✓</span> Cartera, historial i cercador d'actius</li>
          <li><span class="tick">✓</span> Dades protegides amb verificació</li>
        </ul>

        <UiCard
          variant="glass"
          padding="md"
          class="chart-card"
          aria-hidden="true"
        >
          <div class="chart-head">
            <div>
              <span class="chart-label">Cartera simulada</span>
              <strong class="chart-value tabular">10.482,35 €</strong>
            </div>
            <UiBadge variant="on-dark">
              +4,82 %
            </UiBadge>
          </div>
          <svg
            viewBox="0 0 300 80"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id="fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  class="chart-stop"
                  stop-opacity="0.35"
                />
                <stop
                  offset="100%"
                  class="chart-stop"
                  stop-opacity="0"
                />
              </linearGradient>
            </defs>
            <path
              d="M0 62 L30 56 L60 60 L90 44 L120 48 L150 34 L180 40 L210 24 L240 28 L270 12 L300 16 L300 80 L0 80 Z"
              fill="url(#fill)"
            />
            <path
              class="chart-line"
              d="M0 62 L30 56 L60 60 L90 44 L120 48 L150 34 L180 40 L210 24 L240 28 L270 12 L300 16"
              fill="none"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
        </UiCard>
      </div>

      <p class="brand-foot" />
    </aside>

    <!-- Panell del formulari -->
    <main class="panel">
      <UiCard class="card">
        <!-- Estat: correu enviat -->
        <section
          v-if="sent"
          class="success"
        >
          <div class="success-icon">
            ✉
          </div>
          <h2>Revisa el teu correu</h2>
          <p class="muted">
            Hem enviat un enllaç de verificació a
            <strong>{{ normalizedEmail }}</strong>. Fes clic a l'enllaç per activar el teu compte.
          </p>

          <UiAlert
            v-if="info"
            variant="success"
          >
            {{ info }}
          </UiAlert>
          <UiAlert
            v-if="error"
            variant="error"
          >
            {{ error }}
          </UiAlert>

          <UiButton
            variant="secondary"
            block
            :disabled="cooldown > 0"
            @click="resend"
          >
            {{ cooldown > 0 ? `Reenviar correu (${cooldown} s)` : 'Reenviar correu' }}
          </UiButton>
          <RouterLink
            to="/"
            class="back"
          >
            Tornar a l'inici
          </RouterLink>
        </section>

        <!-- Estat: formulari -->
        <form
          v-else
          novalidate
          @submit.prevent="handleSubmit"
        >
          <h2>Crea el teu compte</h2>
          <p class="muted">
            Només et portarà un minut.
          </p>

          <UiInput
            v-model="email"
            label="Correu electrònic"
            type="email"
            autocomplete="email"
            placeholder="nom@exemple.com"
            :error="errors.email"
          />

          <UiInput
            v-model="emailConfirm"
            label="Repeteix el correu electrònic"
            type="email"
            autocomplete="off"
            placeholder="nom@exemple.com"
            :error="errors.emailConfirm"
            @paste.prevent
          />

          <UiInput
            v-model="password"
            label="Contrasenya"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="Crea una contrasenya"
            :error="errors.password"
          >
            <template #trailing>
              <UiButton
                variant="ghost"
                size="sm"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Amagar' : 'Mostrar' }}
              </UiButton>
            </template>
            <ul class="rules">
              <li
                v-for="r in rules"
                :key="r.label"
                :class="{ ok: r.ok }"
              >
                <span>{{ r.ok ? '✓' : '•' }}</span> {{ r.label }}
              </li>
            </ul>
          </UiInput>

          <UiInput
            v-model="passwordConfirm"
            label="Repeteix la contrasenya"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="Repeteix la contrasenya"
            :error="errors.passwordConfirm"
          />

          <UiAlert
            v-if="error"
            variant="error"
          >
            {{ error }}
          </UiAlert>

          <UiButton
            type="submit"
            size="lg"
            block
            :loading="loading"
          >
            {{ loading ? 'Creant el compte…' : 'Crear compte' }}
          </UiButton>

          <p class="login-hint">
            Ja tens compte?
            <RouterLink to="/login">
              Inicia sessió
            </RouterLink>
          </p>
        </form>
      </UiCard>
    </main>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  min-height: 100vh;
  width: 100%;
  text-align: left;
}

/* ---------- Panell de marca ---------- */
.brand {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--tub-space-6);
  padding: var(--tub-space-7) var(--tub-space-8);
  background: var(--tub-gradient-brand);
}
.brand-body h1 {
  margin: 0 0 var(--tub-space-4);
  font-size: var(--tub-text-2xl);
  line-height: 1.15;
}
.lead {
  margin: 0 0 var(--tub-space-5);
  max-width: 460px;
  color: var(--tub-text-on-dark-muted);
  line-height: 1.55;
}
.perks {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--tub-space-6);
  display: grid;
  gap: var(--tub-space-3);
  color: var(--tub-text-on-dark-muted);
}
.tick {
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
.chart-card {
  max-width: 420px;
}
.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--tub-space-2);
}
.chart-label {
  display: block;
  font-size: var(--tub-text-xs);
  color: var(--tub-text-on-dark-faint);
}
.chart-value {
  font-size: 1.5rem;
}
.chart-card svg {
  display: block;
  width: 100%;
  height: 80px;
}
.chart-stop {
  stop-color: var(--tub-green-light);
}
.chart-line {
  stroke: var(--tub-green-light);
}
.brand-foot {
  margin: 0;
  font-size: var(--tub-text-xs);
  color: var(--tub-text-on-dark-faint);
}

/* ---------- Panell del formulari ---------- */
.panel {
  display: grid;
  place-items: center;
  padding: var(--tub-space-6) var(--tub-space-4);
  background: var(--tub-bg);
}
.card {
  max-width: 440px;
}
h2 {
  margin: 0 0 var(--tub-space-1);
  font-size: var(--tub-text-xl);
}
.muted {
  margin: 0 0 var(--tub-space-5);
  color: var(--tub-text-muted);
  line-height: 1.5;
}

.rules {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-1) var(--tub-space-4);
  margin: var(--tub-space-2) 0 0;
  padding: 0;
  font-size: var(--tub-text-xs);
  color: var(--tub-text-muted);
}
.rules li.ok {
  color: var(--tub-green-dark);
  font-weight: 600;
}

.back {
  display: block;
  margin-top: var(--tub-space-4);
  text-align: center;
}
.login-hint {
  margin: var(--tub-space-5) 0 0;
  text-align: center;
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}

.success {
  text-align: center;
}
.success-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto var(--tub-space-4);
  border-radius: var(--tub-radius-pill);
  background: var(--tub-success-bg);
  color: var(--tub-success-text);
  font-size: 1.8rem;
}

/* ---------- Responsive ---------- */
@media (max-width: 900px) {
  .page {
    grid-template-columns: 1fr;
  }
  .brand {
    display: none;
  }
  .panel {
    background: var(--tub-gradient-brand);
  }
}
</style>
