<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { isValidTotpCode, mfaErrorMessage, normalizeTotpCode } from '../utils/mfaErrors'
import { UiAlert, UiBadge, UiButton, UiCard, UiInput } from './ui'

const authStore = useAuthStore()

// loading → inactive ⇄ enrolling → active ⇄ disabling
const status = ref('loading')
const factor = ref(null)
const enrollment = ref(null)

const code = ref('')
const submitted = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')

const normalizedCode = computed(() => normalizeTotpCode(code.value))
const codeError = computed(() =>
  submitted.value && !isValidTotpCode(normalizedCode.value) ? 'Introdueix el codi de 6 dígits.' : ''
)

function resetForm() {
  code.value = ''
  submitted.value = false
  error.value = ''
}

onMounted(async () => {
  try {
    factor.value = await authStore.getTotpFactor()
  } catch {
    error.value = "No s'ha pogut consultar l'estat de la verificació en dos passos."
  }
  status.value = factor.value ? 'active' : 'inactive'
})

async function startEnroll() {
  resetForm()
  notice.value = ''
  busy.value = true
  try {
    enrollment.value = await authStore.enrollTotp()
    status.value = 'enrolling'
  } catch (err) {
    error.value = mfaErrorMessage(err)
  } finally {
    busy.value = false
  }
}

async function confirmEnroll() {
  submitted.value = true
  error.value = ''
  if (codeError.value) return

  busy.value = true
  try {
    await authStore.verifyTotp(enrollment.value.factorId, normalizedCode.value)
    factor.value = { id: enrollment.value.factorId }
    enrollment.value = null
    status.value = 'active'
    resetForm()
    notice.value = "Verificació en dos passos activada. A partir d'ara et demanarem el codi en iniciar sessió."
  } catch (err) {
    error.value = mfaErrorMessage(err)
  } finally {
    busy.value = false
  }
}

function startDisable() {
  resetForm()
  notice.value = ''
  status.value = 'disabling'
}

async function confirmDisable() {
  submitted.value = true
  error.value = ''
  if (codeError.value) return

  busy.value = true
  try {
    await authStore.unenrollTotp(factor.value.id, normalizedCode.value)
    factor.value = null
    status.value = 'inactive'
    resetForm()
    notice.value = 'Verificació en dos passos desactivada.'
  } catch (err) {
    error.value = mfaErrorMessage(err)
  } finally {
    busy.value = false
  }
}

// El factor sense confirmar es queda a Supabase; s'esborra en la propera activació
function cancel() {
  resetForm()
  enrollment.value = null
  status.value = factor.value ? 'active' : 'inactive'
}
</script>

<template>
  <UiCard class="two-factor">
    <div class="two-factor__head">
      <div>
        <h2 class="two-factor__title">
          Verificació en dos passos
        </h2>
        <p class="two-factor__muted">
          Demana un codi de l'aplicació d'autenticació del mòbil en iniciar sessió.
        </p>
      </div>
      <UiBadge
        v-if="status !== 'loading'"
        :variant="factor ? 'success' : 'neutral'"
      >
        {{ factor ? 'Activa' : 'Inactiva' }}
      </UiBadge>
    </div>

    <UiAlert
      v-if="notice"
      variant="success"
    >
      {{ notice }}
    </UiAlert>
    <UiAlert
      v-if="error"
      variant="error"
    >
      {{ error }}
    </UiAlert>

    <div
      v-if="status === 'inactive'"
      class="two-factor__actions"
    >
      <UiButton
        :loading="busy"
        @click="startEnroll"
      >
        Activar
      </UiButton>
    </div>

    <form
      v-else-if="status === 'enrolling'"
      class="two-factor__form"
      novalidate
      @submit.prevent="confirmEnroll"
    >
      <p>
        1. Escaneja aquest codi QR amb una aplicació d'autenticació (Google Authenticator, Microsoft Authenticator, Authy…).
      </p>
      <div class="two-factor__qr">
        <img
          :src="enrollment.qrCode"
          alt="Codi QR per afegir TradeUB a l'aplicació d'autenticació"
          width="180"
          height="180"
        >
      </div>
      <p class="two-factor__muted">
        Si no pots escanejar-lo, introdueix aquesta clau a l'aplicació:
      </p>
      <code class="two-factor__secret tabular">{{ enrollment.secret }}</code>
      <p>2. Introdueix el codi de 6 dígits que apareix a l'aplicació.</p>
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
      <div class="two-factor__actions">
        <UiButton
          type="submit"
          :loading="busy"
        >
          Confirmar
        </UiButton>
        <UiButton
          variant="ghost"
          :disabled="busy"
          @click="cancel"
        >
          Cancel·lar
        </UiButton>
      </div>
    </form>

    <div
      v-else-if="status === 'active'"
      class="two-factor__actions"
    >
      <UiButton
        variant="secondary"
        @click="startDisable"
      >
        Desactivar
      </UiButton>
    </div>

    <form
      v-else-if="status === 'disabling'"
      class="two-factor__form"
      novalidate
      @submit.prevent="confirmDisable"
    >
      <p>Per desactivar-la, introdueix el codi actual de l'aplicació d'autenticació.</p>
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
      <div class="two-factor__actions">
        <UiButton
          type="submit"
          variant="secondary"
          :loading="busy"
        >
          Desactivar
        </UiButton>
        <UiButton
          variant="ghost"
          :disabled="busy"
          @click="cancel"
        >
          Cancel·lar
        </UiButton>
      </div>
    </form>
  </UiCard>
</template>

<style scoped>
.two-factor {
  display: grid;
  gap: var(--tub-space-4);
}
.two-factor__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tub-space-4);
}
.two-factor__title {
  font-size: var(--tub-text-md);
}
.two-factor__muted {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}
.two-factor__form {
  display: grid;
  gap: var(--tub-space-3);
}
.two-factor__qr {
  justify-self: start;
  padding: var(--tub-space-3);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface);
}
.two-factor__qr img {
  display: block;
}
.two-factor__secret {
  padding: var(--tub-space-2) var(--tub-space-3);
  border-radius: var(--tub-radius-sm);
  background: var(--tub-surface-2);
  font-family: var(--tub-font-mono);
  font-size: var(--tub-text-sm);
  overflow-wrap: anywhere;
}
.two-factor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}

@media (max-width: 900px) {
  .two-factor__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
