<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getPasswordRules, isPasswordValid } from '../utils/passwordRules'
import { UiButton, UiInput, UiCard, UiAlert } from '../components/ui'

const router = useRouter()
const authStore = useAuthStore()

// Si l'enllaç ha caducat o ja s'ha usat, Supabase afegeix l'error al hash de la URL
const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
const expired = hashParams.get('error_code') === 'otp_expired'

const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)
const submitted = ref(false)
const loading = ref(false)
const error = ref('')

const rules = computed(() => getPasswordRules(password.value))
const passwordValid = computed(() => isPasswordValid(password.value))
const passwordsMatch = computed(() => password.value === passwordConfirm.value)

const errors = computed(() => ({
  password:
    submitted.value && !passwordValid.value
      ? 'La contrasenya no compleix els requisits.'
      : '',
  passwordConfirm:
    (submitted.value || passwordConfirm.value) && !passwordsMatch.value
      ? 'Les contrasenyes no coincideixen.'
      : '',
}))

// Tradueix els errors de Supabase Auth a missatges en català
function errorMessage(err) {
  switch (err?.code) {
    case 'same_password':
      return "La contrasenya nova ha de ser diferent de l'anterior."
    case 'weak_password':
      return 'La contrasenya és massa feble. Tria una altra.'
    case 'over_request_rate_limit':
      return 'Massa intents seguits. Espera uns minuts i torna-ho a provar.'
  }
  if (err?.name === 'AuthSessionMissingError') {
    return "L'enllaç de recuperació no és vàlid. Sol·licita'n un de nou."
  }
  if (err?.name === 'AuthRetryableFetchError') {
    return "No s'ha pogut connectar amb el servidor. Comprova la connexió."
  }
  return "No s'ha pogut canviar la contrasenya. Torna-ho a provar."
}

async function handleSubmit() {
  submitted.value = true
  error.value = ''
  if (!passwordValid.value || !passwordsMatch.value) return

  loading.value = true
  try {
    await authStore.updatePassword(password.value)
    router.push('/login')
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="panel">
    <UiCard class="card">
      <section v-if="expired">
        <h2>Enllaç no vàlid</h2>
        <UiAlert variant="error">
          L'enllaç de recuperació ha caducat o ja s'ha utilitzat
        </UiAlert>
        <RouterLink to="/forgot-password" class="back">Sol·licitar un enllaç nou</RouterLink>
      </section>

      <form v-else novalidate @submit.prevent="handleSubmit">
        <h2>Nova contrasenya</h2>
        <p class="muted">Tria una contrasenya nova per al teu compte.</p>

        <UiInput
          v-model="password"
          label="Contrasenya nova"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          placeholder="Crea una contrasenya"
          :error="errors.password"
        >
          <template #trailing>
            <UiButton variant="ghost" size="sm" @click="showPassword = !showPassword">
              {{ showPassword ? 'Amagar' : 'Mostrar' }}
            </UiButton>
          </template>
          <ul class="rules">
            <li v-for="r in rules" :key="r.label" :class="{ ok: r.ok }">
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

        <UiAlert v-if="error" variant="error">{{ error }}</UiAlert>

        <UiButton type="submit" size="lg" block :loading="loading">
          {{ loading ? 'Desant…' : 'Canviar contrasenya' }}
        </UiButton>
      </form>
    </UiCard>
  </main>
</template>

<style scoped>
.panel {
  display: grid;
  place-items: center;
  min-height: 100vh;
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
</style>