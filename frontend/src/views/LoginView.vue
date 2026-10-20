<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { safeRedirect } from '../utils/redirect'
import { UiAlert, UiButton, UiInput, UiLogo } from '../components/ui'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = ref('')
const password = ref('')
const showPassword = ref(false)

const loading = ref(false)
const submitted = ref(false)
const error = ref('')

const normalizedEmail = computed(() => email.value.trim().toLowerCase())

const errors = computed(() => ({
  email:
    submitted.value && !EMAIL_RE.test(normalizedEmail.value)
      ? 'Introdueix un correu vàlid.'
      : '',
  password: submitted.value && !password.value ? 'Introdueix la contrasenya.' : '',
}))

// Tradueix els errors de Supabase Auth a missatges en català
function errorMessage(err) {
  switch (err?.code) {
    case 'invalid_credentials':
      return 'Correu o contrasenya incorrectes.'
    case 'email_not_confirmed':
      return "Encara no has verificat el correu. Revisa la safata d'entrada."
    case 'over_request_rate_limit':
      return 'Massa intents seguits. Espera uns minuts i torna-ho a provar.'
  }
  if (err?.name === 'AuthRetryableFetchError') {
    return "No s'ha pogut connectar amb el servidor. Comprova la connexió."
  }
  return "No s'ha pogut iniciar sessió. Torna-ho a provar."
}

async function handleSubmit() {
  submitted.value = true
  error.value = ''
  if (errors.value.email || errors.value.password) return

  loading.value = true
  try {
    await authStore.login(normalizedEmail.value, password.value)
    const target = safeRedirect(route.query.redirect)
    // replace: el botó "enrere" no torna al formulari de login.
    // Amb la 2FA activa, abans cal el codi: /mfa portarà després a la destinació
    await router.replace(authStore.needsMfa ? { name: 'mfa', query: { redirect: target } } : target)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <!-- Panell de marca -->
    <aside class="login__brand tub-on-dark">
      <div class="login__brand-inner">
        <UiLogo size="lg" />
        <div class="login__brand-text">
          <h2 class="login__brand-title">
            Benvingut de nou.
          </h2>
          <p class="login__lead">
            La teva cartera i els teus actius t'esperen.
          </p>
        </div>
        <ul class="login__perks">
          <li><span class="login__tick">✓</span> Cartera i historial al dia</li>
          <li><span class="login__tick">✓</span> Cercador d'actius</li>
        </ul>
      </div>
    </aside>

    <!-- Panell del formulari -->
    <section class="login__panel">
      <div class="login__content">
        <div class="login__mobile-logo">
          <UiLogo />
        </div>

        <form
          novalidate
          @submit.prevent="handleSubmit"
        >
          <header class="login__head">
            <h1 class="login__title">
              Inicia sessió
            </h1>
            <p class="login__subtitle">
              Accedeix al teu compte.
            </p>
          </header>

          <UiAlert
            v-if="error"
            variant="error"
          >
            {{ error }}
          </UiAlert>

          <UiInput
            v-model="email"
            label="Correu electrònic"
            type="email"
            autocomplete="email"
            placeholder="nom@exemple.com"
            :error="errors.email"
          />

          <UiInput
            v-model="password"
            label="Contrasenya"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            :error="errors.password"
          >
            <template #trailing>
              <UiButton
                variant="ghost"
                size="sm"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Amagar' : 'Mostrar' }}
              </UiButton>
            </template>
          </UiInput>

          <p class="login__forgot">
            <RouterLink :to="{ name: 'forgot-password' }">
              Has oblidat la contrasenya?
            </RouterLink>
          </p>

          <UiButton
            type="submit"
            size="lg"
            block
            :loading="loading"
            class="login__submit"
          >
            Inicia sessió
          </UiButton>
        </form>

        <p class="login__footer">
          No tens compte?
          <RouterLink :to="{ name: 'register' }">
            Registra't
          </RouterLink>
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  min-height: 100vh;
}

.login__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tub-space-8) var(--tub-space-6);
  background: var(--tub-gradient-brand);
}
.login__brand-inner {
  display: grid;
  justify-items: center;
  gap: var(--tub-space-4);
  text-align: center;
}
.login__brand-text {
  display: grid;
  gap: var(--tub-space-3);
  max-width: 420px;
}
.login__brand-title {
  font-size: var(--tub-text-2xl);
  line-height: 1.15;
}
.login__lead {
  color: var(--tub-text-on-dark-muted);
  line-height: 1.55;
}
.login__perks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--tub-space-2);
  justify-items: center;
  color: var(--tub-text-on-dark-muted);
}
.login__tick {
  color: var(--tub-green);
  margin-right: var(--tub-space-1);
}

.login__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tub-space-8) var(--tub-space-5);
  background: var(--tub-surface);
}
.login__content {
  display: grid;
  gap: var(--tub-space-6);
  width: 100%;
  max-width: 380px;
}
.login__mobile-logo {
  display: none;
}

.login__head {
  display: grid;
  gap: var(--tub-space-1);
  margin-bottom: var(--tub-space-6);
}
.login__title {
  font-size: var(--tub-text-xl);
}
.login__subtitle {
  color: var(--tub-text-muted);
}
.login__forgot {
  text-align: right;
  font-size: var(--tub-text-sm);
}
.login__submit {
  margin-top: var(--tub-space-2);
}
.login__footer {
  text-align: center;
  font-size: var(--tub-text-sm);
  color: var(--tub-text-muted);
}

/* Per sota de 900px s'amaga el panell de marca i el logo passa a sobre del formulari */
@media (max-width: 900px) {
  .login {
    grid-template-columns: minmax(0, 1fr);
  }
  .login__brand {
    display: none;
  }
  .login__mobile-logo {
    display: flex;
    justify-content: center;
  }
}
</style>
