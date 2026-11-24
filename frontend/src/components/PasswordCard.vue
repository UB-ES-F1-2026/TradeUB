<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { getPasswordRules, isPasswordValid } from '../utils/passwordRules'
import { isValidTotpCode, mfaErrorMessage, normalizeTotpCode } from '../utils/mfaErrors'
import { UiAlert, UiButton, UiCard, UiInput } from './ui'

const authStore = useAuthStore()

const open = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')
const code = ref('')
const showPassword = ref(false)
const submitted = ref(false)
const busy = ref(false)
// Errors que retorna Supabase, per camp
const serverErrors = ref({ currentPassword: '', newPassword: '', code: '' })
const error = ref('')
const notice = ref('')

// Amb la 2FA activa també es demana el codi
const needsCode = computed(() => authStore.aal.nextLevel === 'aal2')

const rules = computed(() => getPasswordRules(newPassword.value))
const normalizedCode = computed(() => normalizeTotpCode(code.value))

const errors = computed(() => {
  const result = {
    currentPassword: serverErrors.value.currentPassword,
    newPassword: serverErrors.value.newPassword,
    newPasswordConfirm: '',
    code: serverErrors.value.code,
  }
  if (submitted.value) {
    if (!currentPassword.value) result.currentPassword = 'Introdueix la contrasenya actual.'
    if (!isPasswordValid(newPassword.value)) {
      result.newPassword = 'La contrasenya no compleix els requisits.'
    } else if (newPassword.value === currentPassword.value) {
      result.newPassword = "La contrasenya nova ha de ser diferent de l'anterior."
    }
    if (needsCode.value && !isValidTotpCode(normalizedCode.value)) {
      result.code = 'Introdueix el codi de 6 dígits.'
    }
  }
  if ((submitted.value || newPasswordConfirm.value) && newPassword.value !== newPasswordConfirm.value) {
    result.newPasswordConfirm = 'Les contrasenyes no coincideixen.'
  }
  return result
})

const hasErrors = computed(() => Object.values(errors.value).some(Boolean))

function resetForm() {
  currentPassword.value = ''
  newPassword.value = ''
  newPasswordConfirm.value = ''
  code.value = ''
  showPassword.value = false
  submitted.value = false
  serverErrors.value = { currentPassword: '', newPassword: '', code: '' }
  error.value = ''
}

function startChange() {
  resetForm()
  notice.value = ''
  open.value = true
}

function cancel() {
  resetForm()
  open.value = false
}

// Tradueix l'error de Supabase al camp que correspon o a un avís general
function showServerError(err) {
  switch (err?.code) {
    case 'invalid_credentials':
      serverErrors.value.currentPassword = 'La contrasenya actual és incorrecta.'
      return
    case 'same_password':
      serverErrors.value.newPassword = "La contrasenya nova ha de ser diferent de l'anterior."
      return
    case 'weak_password':
      serverErrors.value.newPassword = 'La contrasenya és massa feble. Tria una altra.'
      return
    case 'mfa_verification_failed':
    case 'mfa_challenge_expired':
      serverErrors.value.code = mfaErrorMessage(err)
      return
    case 'over_request_rate_limit':
      error.value = 'Massa intents seguits. Espera uns minuts i torna-ho a provar.'
      return
  }
  if (err?.name === 'AuthRetryableFetchError') {
    error.value = "No s'ha pogut connectar amb el servidor. Comprova la connexió."
    return
  }
  error.value = "No s'ha pogut canviar la contrasenya. Torna-ho a provar."
}

async function handleSubmit() {
  serverErrors.value = { currentPassword: '', newPassword: '', code: '' }
  error.value = ''
  submitted.value = true
  if (hasErrors.value) return

  busy.value = true
  try {
    await authStore.changePassword(
      currentPassword.value,
      newPassword.value,
      needsCode.value ? normalizedCode.value : undefined,
    )
    cancel()
    notice.value = "S'ha canviat la contrasenya."
  } catch (err) {
    showServerError(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiCard class="password">
    <div>
      <h2 class="password__title">
        Contrasenya
      </h2>
      <p class="password__muted">
        La que fas servir per iniciar sessió.
      </p>
    </div>

    <UiAlert
      v-if="notice"
      variant="success"
    >
      {{ notice }}
    </UiAlert>

    <div
      v-if="!open"
      class="password__actions"
    >
      <UiButton
        variant="secondary"
        @click="startChange"
      >
        Canvia la contrasenya
      </UiButton>
    </div>

    <form
      v-else
      class="password__form"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <UiInput
        v-model="currentPassword"
        label="Contrasenya actual"
        :type="showPassword ? 'text' : 'password'"
        autocomplete="current-password"
        :error="errors.currentPassword"
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
      </UiInput>

      <UiInput
        v-model="newPassword"
        label="Contrasenya nova"
        :type="showPassword ? 'text' : 'password'"
        autocomplete="new-password"
        :error="errors.newPassword"
      >
        <ul class="password__rules">
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
        v-model="newPasswordConfirm"
        label="Repeteix la contrasenya nova"
        :type="showPassword ? 'text' : 'password'"
        autocomplete="new-password"
        :error="errors.newPasswordConfirm"
      />

      <UiInput
        v-if="needsCode"
        v-model="code"
        label="Codi d'autenticació"
        hint="Tens activada la verificació en dos passos: introdueix el codi de l'aplicació."
        inputmode="numeric"
        autocomplete="one-time-code"
        placeholder="123456"
        maxlength="7"
        class="tabular"
        :error="errors.code"
      />

      <UiAlert
        v-if="error"
        variant="error"
      >
        {{ error }}
      </UiAlert>

      <div class="password__actions">
        <UiButton
          type="submit"
          :loading="busy"
        >
          Desa
        </UiButton>
        <UiButton
          variant="ghost"
          :disabled="busy"
          @click="cancel"
        >
          Cancel·la
        </UiButton>
      </div>
    </form>
  </UiCard>
</template>

<style scoped>
.password {
  display: grid;
  gap: var(--tub-space-4);
}
.password__title {
  font-size: var(--tub-text-md);
}
.password__muted {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}
.password__form {
  display: grid;
  gap: var(--tub-space-3);
}
.password__rules {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-1) var(--tub-space-4);
  margin: var(--tub-space-2) 0 0;
  padding: 0;
  font-size: var(--tub-text-xs);
  color: var(--tub-text-muted);
}
.password__rules li.ok {
  color: var(--tub-green-dark);
  font-weight: 600;
}
.password__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}

@media (max-width: 900px) {
  .password__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
