<script setup>
import { computed, onMounted, ref } from 'vue'
import { useProfileStore } from '../stores/profile'
import {
  PIN_CURRENT_ERROR,
  PIN_FORMAT_ERROR,
  PIN_LENGTH,
  PIN_SAVE_ERROR,
  validatePinForm,
} from '../utils/pin'
import { UiAlert, UiBadge, UiButton, UiCard, UiInput } from './ui'

// PIN de seguretat de les operacions (US1.5). Només es mostra als usuaris verificats (ho decideix PerfilView)
const profileStore = useProfileStore()
const hasPin = computed(() => profileStore.hasPin)
// Fins que el backend no respon no se sap si cal crear el PIN o canviar-lo
const pinKnown = computed(() => profileStore.pinConfigured !== null)

onMounted(() => profileStore.loadPinStatus())

const editing = ref(false)
const changing = ref(false)
const form = ref({ currentPin: '', newPin: '', repeatPin: '' })
const errors = ref({})
const busy = ref(false)
const error = ref('')
const notice = ref('')

function resetForm() {
  form.value = { currentPin: '', newPin: '', repeatPin: '' }
  errors.value = {}
  error.value = ''
}

function startEdit() {
  resetForm()
  notice.value = ''
  changing.value = hasPin.value
  editing.value = true
}

function cancel() {
  resetForm()
  editing.value = false
}

// Els errors de format i del PIN actual (el detail del backend, a ApiError.message) van al seu camp;
// qualsevol altre error, a l'alerta de la targeta
function showApiError(err) {
  if (err?.message === PIN_CURRENT_ERROR) {
    errors.value = { currentPin: PIN_CURRENT_ERROR }
    form.value.currentPin = ''
  } else if (err?.message === PIN_FORMAT_ERROR) {
    errors.value = { newPin: PIN_FORMAT_ERROR }
  } else {
    error.value = PIN_SAVE_ERROR
  }
}

async function save() {
  error.value = ''
  errors.value = validatePinForm(form.value, { changing: changing.value })
  if (Object.keys(errors.value).length) return

  busy.value = true
  try {
    await profileStore.savePin({
      pin: form.value.newPin,
      currentPin: changing.value ? form.value.currentPin : undefined,
    })
    notice.value = changing.value ? 'PIN de seguretat canviat.' : 'PIN de seguretat configurat.'
    resetForm()
    editing.value = false
  } catch (err) {
    showApiError(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiCard class="pin-card">
    <div class="pin-card__head">
      <div>
        <h2 class="pin-card__title">
          PIN de seguretat
        </h2>
        <p class="pin-card__muted">
          Codi de {{ PIN_LENGTH }} dígits que et demanarem per confirmar operacions amb diners, com una retirada.
        </p>
      </div>
      <UiBadge
        v-if="pinKnown"
        :variant="hasPin ? 'success' : 'neutral'"
      >
        {{ hasPin ? 'Configurat' : 'Sense configurar' }}
      </UiBadge>
    </div>

    <UiAlert
      v-if="notice"
      variant="success"
    >
      {{ notice }}
    </UiAlert>
    <UiAlert
      v-if="error || profileStore.pinError"
      variant="error"
    >
      {{ error || profileStore.pinError }}
    </UiAlert>

    <div
      v-if="!editing && pinKnown"
      class="pin-card__actions"
    >
      <UiButton
        :variant="hasPin ? 'secondary' : 'primary'"
        @click="startEdit"
      >
        {{ hasPin ? 'Canviar el PIN' : 'Configurar el PIN' }}
      </UiButton>
    </div>

    <form
      v-else-if="editing"
      class="pin-card__form"
      novalidate
      @submit.prevent="save"
    >
      <UiInput
        v-if="changing"
        v-model="form.currentPin"
        label="PIN actual"
        type="password"
        inputmode="numeric"
        autocomplete="off"
        :maxlength="PIN_LENGTH"
        class="tabular"
        :error="errors.currentPin"
      />
      <UiInput
        v-model="form.newPin"
        :label="changing ? 'PIN nou' : 'PIN'"
        type="password"
        inputmode="numeric"
        autocomplete="off"
        :maxlength="PIN_LENGTH"
        class="tabular"
        :error="errors.newPin"
        :hint="`${PIN_LENGTH} dígits numèrics.`"
      />
      <UiInput
        v-model="form.repeatPin"
        :label="changing ? 'Repeteix el PIN nou' : 'Repeteix el PIN'"
        type="password"
        inputmode="numeric"
        autocomplete="off"
        :maxlength="PIN_LENGTH"
        class="tabular"
        :error="errors.repeatPin"
      />
      <div class="pin-card__actions">
        <UiButton
          type="submit"
          :loading="busy"
        >
          Desa el PIN
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
.pin-card {
  display: grid;
  gap: var(--tub-space-4);
}
.pin-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tub-space-4);
}
.pin-card__title {
  font-size: var(--tub-text-md);
}
.pin-card__muted {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}
.pin-card__form {
  display: grid;
  gap: var(--tub-space-1);
  max-width: 360px;
}
.pin-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}

@media (max-width: 900px) {
  .pin-card__form {
    max-width: none;
  }
  .pin-card__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
