<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../services/supabase'

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

const rules = computed(() => [
  { label: 'Mínim 8 caràcters', ok: password.value.length >= 8 },
  { label: 'Almenys un número', ok: /\d/.test(password.value) },
])
const passwordValid = computed(() => rules.value.every((r) => r.ok))
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
  const { error: err } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail.value,
  })
  if (err) {
    error.value = err.message
  } else {
    info.value = 'Correu reenviat. Revisa també la carpeta de correu brossa.'
    startCooldown()
  }
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="page">
    <!-- Panell de marca -->
    <aside class="brand">
      <div class="brand-top">
        <RouterLink to="/" class="logo">
          <span class="logo-mark">T</span>
          <span class="logo-text">TradeUB</span>
        </RouterLink>
      </div>

      <div class="brand-body">
        <h1>Comença a invertir<br />amb diners simulats.</h1>
        <p class="lead">
          Practica amb accions i ETFs sense risc. Una plataforma pensada per
          aprendre a invertir pas a pas.
        </p>

        <ul class="perks">
          <li><span class="tick">✓</span> Compte gratuït i sense compromís</li>
          <li><span class="tick">✓</span> Cartera, historial i cercador d'actius</li>
          <li><span class="tick">✓</span> Dades protegides amb verificació</li>
        </ul>

        <div class="chart-card" aria-hidden="true">
          <div class="chart-head">
            <div>
              <span class="chart-label">Cartera simulada</span>
              <strong class="chart-value">10.482,35 €</strong>
            </div>
            <span class="chart-badge">+4,82 %</span>
          </div>
          <svg viewBox="0 0 300 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#34d399" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#34d399" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 62 L30 56 L60 60 L90 44 L120 48 L150 34 L180 40 L210 24 L240 28 L270 12 L300 16 L300 80 L0 80 Z"
              fill="url(#fill)"
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
        </div>
      </div>

      <p class="brand-foot"></p>
    </aside>

    <!-- Panell del formulari -->
    <main class="panel">
      <div class="card">
        <!-- Estat: correu enviat -->
        <section v-if="sent" class="success">
          <div class="success-icon">✉</div>
          <h2>Revisa el teu correu</h2>
          <p class="muted">
            Hem enviat un enllaç de verificació a
            <strong>{{ normalizedEmail }}</strong
            >. Fes clic a l'enllaç per activar el teu compte.
          </p>

          <p v-if="info" class="alert alert-ok">{{ info }}</p>
          <p v-if="error" class="alert alert-error">{{ error }}</p>

          <button class="btn btn-secondary" :disabled="cooldown > 0" @click="resend">
            {{ cooldown > 0 ? `Reenviar correu (${cooldown} s)` : 'Reenviar correu' }}
          </button>
          <RouterLink to="/" class="link center">Tornar a l'inici</RouterLink>
        </section>

        <!-- Estat: formulari -->
        <form v-else novalidate @submit.prevent="handleSubmit">
          <h2>Crea el teu compte</h2>
          <p class="muted">Només et portarà un minut.</p>

          <div class="field" :class="{ invalid: errors.email }">
            <label for="email">Correu electrònic</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="nom@exemple.com"
            />
            <small v-if="errors.email" class="err">{{ errors.email }}</small>
          </div>

          <div class="field" :class="{ invalid: errors.emailConfirm }">
            <label for="emailConfirm">Repeteix el correu electrònic</label>
            <input
              id="emailConfirm"
              v-model="emailConfirm"
              type="email"
              autocomplete="off"
              placeholder="nom@exemple.com"
              @paste.prevent
            />
            <small v-if="errors.emailConfirm" class="err">{{ errors.emailConfirm }}</small>
          </div>

          <div class="field" :class="{ invalid: errors.password }">
            <label for="password">Contrasenya</label>
            <div class="input-wrap">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Crea una contrasenya"
              />
              <button
                type="button"
                class="toggle"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Amagar' : 'Mostrar' }}
              </button>
            </div>
            <ul class="rules">
              <li v-for="r in rules" :key="r.label" :class="{ ok: r.ok }">
                <span>{{ r.ok ? '✓' : '•' }}</span> {{ r.label }}
              </li>
            </ul>
            <small v-if="errors.password" class="err">{{ errors.password }}</small>
          </div>

          <div class="field" :class="{ invalid: errors.passwordConfirm }">
            <label for="passwordConfirm">Repeteix la contrasenya</label>
            <input
              id="passwordConfirm"
              v-model="passwordConfirm"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Repeteix la contrasenya"
            />
            <small v-if="errors.passwordConfirm" class="err">{{
              errors.passwordConfirm
            }}</small>
          </div>

          <p v-if="error" class="alert alert-error" role="alert">{{ error }}</p>

          <button class="btn btn-primary" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? 'Creant el compte…' : 'Crear compte' }}
          </button>

          <p class="login-hint">
            Ja tens compte?
            <RouterLink to="/login" class="link">Inicia sessió</RouterLink>
          </p>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page {
  --navy: #0b1b34;
  --navy-2: #12305a;
  --green: #10b981;
  --green-dark: #059669;
  --text: #0f172a;
  --muted: #64748b;
  --border: #dbe2ea;
  --danger: #dc2626;

  display: grid;
  grid-template-columns: 1.05fr 1fr;
  min-height: 100vh;
  width: 100%;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--text);
  text-align: left;
}

/* ---------- Brand panel ---------- */
.brand {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
  padding: 2.5rem 3.5rem;
  color: #fff;
  background:
    radial-gradient(circle at 85% 10%, rgba(16, 185, 129, 0.22), transparent 45%),
    linear-gradient(160deg, var(--navy) 0%, var(--navy-2) 100%);
}
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: #fff;
}
.logo-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--green);
  font-weight: 800;
}
.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.brand-body h1 {
  margin: 0 0 1rem;
  font-size: 2.3rem;
  line-height: 1.15;
  font-weight: 700;
}
.lead {
  margin: 0 0 1.6rem;
  max-width: 460px;
  color: #cbd5e1;
  line-height: 1.55;
}
.perks {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem;
  display: grid;
  gap: 0.7rem;
  color: #e2e8f0;
}
.tick {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-right: 0.5rem;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  font-size: 0.75rem;
  font-weight: 700;
}
.chart-card {
  max-width: 420px;
  padding: 1.1rem 1.2rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(6px);
}
.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.4rem;
}
.chart-label {
  display: block;
  font-size: 0.8rem;
  color: #94a3b8;
}
.chart-value {
  font-size: 1.5rem;
}
.chart-badge {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(52, 211, 153, 0.18);
  color: #34d399;
  font-size: 0.8rem;
  font-weight: 700;
}
.chart-card svg {
  display: block;
  width: 100%;
  height: 80px;
}
.brand-foot {
  margin: 0;
  font-size: 0.8rem;
  color: #94a3b8;
}

/* ---------- Form panel ---------- */
.panel {
  display: grid;
  place-items: center;
  padding: 2rem 1.25rem;
  background: #f4f7fb;
}
.card {
  width: 100%;
  max-width: 440px;
  padding: 2.25rem 2rem;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
}
h2 {
  margin: 0 0 0.35rem;
  font-size: 1.6rem;
}
.muted {
  margin: 0 0 1.5rem;
  color: var(--muted);
  line-height: 1.5;
}

.field {
  margin-bottom: 1.05rem;
}
.field label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.88rem;
  font-weight: 600;
}
.field input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 0.9rem;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: #fff;
  color: var(--text);
  font-size: 0.97rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field input:focus {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
}
.field.invalid input {
  border-color: var(--danger);
}
.field.invalid input:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}
.err {
  display: block;
  margin-top: 0.3rem;
  color: var(--danger);
  font-size: 0.82rem;
}

.input-wrap {
  position: relative;
}
.input-wrap input {
  padding-right: 4.8rem;
}
.toggle {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  padding: 0.3rem 0.55rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--green-dark);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.toggle:hover {
  background: #ecfdf5;
}

.rules {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0.55rem 0 0;
  padding: 0;
  font-size: 0.82rem;
  color: var(--muted);
}
.rules li.ok {
  color: var(--green-dark);
  font-weight: 600;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.05s;
}
.btn:active:not(:disabled) {
  transform: translateY(1px);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-primary {
  margin-top: 0.4rem;
  background: var(--green);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: var(--green-dark);
}
.btn-secondary {
  margin-top: 0.5rem;
  background: #fff;
  color: var(--text);
  border: 1.5px solid var(--border);
}
.btn-secondary:hover:not(:disabled) {
  background: #f8fafc;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.alert {
  margin: 0 0 1rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  font-size: 0.9rem;
}
.alert-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}
.alert-ok {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.link {
  color: var(--green-dark);
  font-weight: 600;
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}
.link.center {
  display: block;
  margin-top: 1.1rem;
  text-align: center;
}
.login-hint {
  margin: 1.3rem 0 0;
  text-align: center;
  color: var(--muted);
  font-size: 0.92rem;
}

.success {
  text-align: center;
}
.success-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background: #ecfdf5;
  color: var(--green-dark);
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
    background: linear-gradient(160deg, var(--navy) 0%, var(--navy-2) 100%);
  }
}
</style>