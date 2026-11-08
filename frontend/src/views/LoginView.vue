<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { safeRedirect } from '../utils/redirect'
import { UiAlert, UiButton, UiInput } from '../components/ui'
import AuthLayout from '../components/AuthLayout.vue'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const perks = ['Cartera i historial al dia', "Cercador d'actius"]

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
  <AuthLayout
    title="Benvingut de nou."
    lead="La teva cartera i els teus actius t'esperen."
    :perks="perks"
  >
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

      <p class="login__footer">
        No tens compte?
        <RouterLink :to="{ name: 'register' }">
          Registra't
        </RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>

<style scoped>
.login__head {
  display: grid;
  gap: var(--tub-space-1);
  margin-bottom: var(--tub-space-5);
}
.login__title {
  font-size: var(--tub-text-xl);
}
.login__subtitle {
  color: var(--tub-text-muted);
  line-height: 1.5;
}
.login__forgot {
  text-align: right;
  font-size: var(--tub-text-sm);
}
.login__submit {
  margin-top: var(--tub-space-4);
}
.login__footer {
  margin-top: var(--tub-space-5);
  text-align: center;
  font-size: var(--tub-text-sm);
  color: var(--tub-text-muted);
}
</style>
