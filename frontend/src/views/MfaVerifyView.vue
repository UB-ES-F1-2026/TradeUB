<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useOnboardingStore } from '../stores/onboarding'
import { safeRedirect } from '../utils/redirect'
import { isValidTotpCode, mfaErrorMessage, normalizeTotpCode } from '../utils/mfaErrors'
import { UiAlert, UiButton, UiCard, UiInput } from '../components/ui'

const authStore = useAuthStore()
const onboarding = useOnboardingStore()
const route = useRoute()
const router = useRouter()

const code = ref('')
const submitted = ref(false)
const loading = ref(false)
const cancelling = ref(false)
const error = ref('')

const normalizedCode = computed(() => normalizeTotpCode(code.value))
const codeError = computed(() =>
  submitted.value && !isValidTotpCode(normalizedCode.value) ? 'Introdueix el codi de 6 dígits.' : ''
)

async function handleSubmit() {
  submitted.value = true
  error.value = ''
  if (codeError.value) return

  loading.value = true
  try {
    await authStore.verifyMfaLogin(normalizedCode.value)
    // Sense l'onboarding acabat, primer es passa per la pantalla de benvinguda
    await router.replace(onboarding.isComplete ? safeRedirect(route.query.redirect) : { name: 'onboarding' })
  } catch (err) {
    error.value = mfaErrorMessage(err)
    code.value = ''
    submitted.value = false
  } finally {
    loading.value = false
  }
}

// Sortir del segon pas: es tanca la sessió aal1 i es torna al login
async function handleCancel() {
  cancelling.value = true
  try {
    await authStore.logout()
  } finally {
    cancelling.value = false
    await router.replace({ name: 'login' })
  }
}
</script>

<template>
  <div class="panel">
    <UiCard class="card">
      <form
        novalidate
        @submit.prevent="handleSubmit"
      >
        <h2>Verificació en dos passos</h2>
        <p class="muted">
          Introdueix el codi de 6 dígits que mostra la teva aplicació d'autenticació.
        </p>

        <UiAlert
          v-if="error"
          variant="error"
        >
          {{ error }}
        </UiAlert>

        <UiInput
          v-model="code"
          label="Codi d'autenticació"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="123456"
          maxlength="7"
          class="tabular"
          :error="codeError"
        />

        <UiButton
          type="submit"
          size="lg"
          block
          :loading="loading"
        >
          Verificar
        </UiButton>

        <UiButton
          variant="ghost"
          block
          class="cancel"
          :loading="cancelling"
          @click="handleCancel"
        >
          Cancel·lar
        </UiButton>
      </form>
    </UiCard>
  </div>
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
.cancel {
  margin-top: var(--tub-space-3);
}
</style>
