<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../services/api'
import { useProfileStore } from '../stores/profile'
import { UiAlert, UiButton, UiInput } from './ui'
import {
  PIN_CHECK_FAILED_ERROR,
  PIN_FORMAT_ERROR,
  PIN_INCORRECT_ERROR,
  PIN_LENGTH,
  PIN_NOT_CONFIGURED_ERROR,
  isValidPin,
  pinErrorMessage,
} from '../utils/pin'

// Diàleg que demana el PIN de seguretat (US1.5) abans d'executar una operació: retirada (US3.3) i, més endavant,
// compra i venda. L'operació la fa el pare amb `confirm(pin)`, que envia el PIN a la capçalera X-PIN.
// Els errors del PIN es resolen aquí; qualsevol altre error tanca el diàleg i el rep el pare amb l'event `error`
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  // async (pin) => resultat. Si llança un error, el diàleg decideix si és del PIN o de l'operació
  confirm: { type: Function, required: true },
})
const emit = defineEmits(['cancel', 'done', 'error'])

const router = useRouter()
const profile = useProfileStore()
const dialog = ref(null)
const pinInput = ref(null)

const pin = ref('')
const submitted = ref(false)
const pinError = ref('')
const alert = ref('')
const pinMissing = ref(false)
const loading = ref(false)

const fieldError = computed(() => {
  if (pinError.value) return pinError.value
  return submitted.value && !isValidPin(pin.value) ? PIN_FORMAT_ERROR : ''
})

function reset() {
  pin.value = ''
  submitted.value = false
  pinError.value = ''
  alert.value = ''
  pinMissing.value = false
  loading.value = false
}

// showModal bloqueja la resta de la pàgina, tanca amb Esc i manté el focus dins del diàleg.
// jsdom (tests) no l'implementa: llavors el contingut es mostra igualment perquè depèn d'`open`
watch(
  () => props.open,
  async (open) => {
    if (open) {
      reset()
      await nextTick()
      if (dialog.value?.showModal && !dialog.value.open) dialog.value.showModal()
      pinInput.value?.$el.querySelector('input')?.focus()
      await checkPinConfigured()
    } else if (dialog.value?.open) {
      dialog.value.close()
    }
  },
)

// Sense PIN configurat s'avisa abans d'escriure'l (GET /profile/pin). Si la consulta falla es deixa escriure igualment:
// require_pin ho torna a comprovar en enviar l'operació
async function checkPinConfigured() {
  if (profile.pinConfigured !== true) await profile.loadPinStatus()
  if (profile.pinConfigured === false) pinMissing.value = true
}

function cancel() {
  if (loading.value) return
  emit('cancel')
}

// Esc dispara `cancel` al <dialog>: mentre s'envia l'operació no es pot tancar
function onNativeCancel(event) {
  event.preventDefault()
  cancel()
}

function clearMessages() {
  pinError.value = ''
  alert.value = ''
}

async function submit() {
  submitted.value = true
  clearMessages()
  if (fieldError.value) return

  loading.value = true
  try {
    const result = await props.confirm(pin.value)
    loading.value = false
    emit('done', result)
  } catch (e) {
    loading.value = false
    const message = e instanceof ApiError ? pinErrorMessage(e.status, e.message) : ''
    if (message === PIN_INCORRECT_ERROR) {
      // El diàleg es queda obert i el camp es buida
      pinError.value = message
      pin.value = ''
      submitted.value = false
    } else if (message === PIN_NOT_CONFIGURED_ERROR) {
      pinMissing.value = true
    } else if (message === PIN_CHECK_FAILED_ERROR) {
      alert.value = message
    } else {
      emit('error', e)
    }
  }
}

function goToProfile() {
  emit('cancel')
  router.push({ name: 'perfil' })
}
</script>

<template>
  <dialog
    ref="dialog"
    class="pin-dialog"
    aria-labelledby="pin-dialog-title"
    @cancel="onNativeCancel"
  >
    <form
      v-if="open"
      class="pin-dialog__form"
      novalidate
      data-test="pin-dialog"
      @submit.prevent="submit"
    >
      <div>
        <h2
          id="pin-dialog-title"
          class="pin-dialog__title"
        >
          {{ title }}
        </h2>
        <!-- Resum de l'operació que es confirma (import, destinació…) -->
        <div class="pin-dialog__summary">
          <slot />
        </div>
      </div>

      <template v-if="pinMissing">
        <UiAlert
          variant="warning"
          data-test="pin-missing"
        >
          {{ PIN_NOT_CONFIGURED_ERROR }}
        </UiAlert>
        <div class="pin-dialog__actions">
          <UiButton
            variant="secondary"
            data-test="pin-go-profile"
            @click="goToProfile"
          >
            Ves al perfil
          </UiButton>
          <UiButton
            variant="ghost"
            data-test="pin-cancel"
            @click="cancel"
          >
            Cancel·la
          </UiButton>
        </div>
      </template>

      <template v-else>
        <UiAlert
          v-if="alert"
          variant="error"
          data-test="pin-alert"
        >
          {{ alert }}
        </UiAlert>
        <UiInput
          ref="pinInput"
          v-model="pin"
          label="PIN de seguretat"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          :maxlength="PIN_LENGTH"
          :error="fieldError"
          data-test="pin-input"
          @update:model-value="clearMessages"
        />
        <div class="pin-dialog__actions">
          <UiButton
            type="submit"
            :loading="loading"
          >
            Confirma
          </UiButton>
          <UiButton
            variant="ghost"
            :disabled="loading"
            data-test="pin-cancel"
            @click="cancel"
          >
            Cancel·la
          </UiButton>
        </div>
      </template>
    </form>
  </dialog>
</template>

<style scoped>
.pin-dialog {
  width: min(420px, calc(100vw - 2 * var(--tub-space-4)));
  padding: var(--tub-space-5);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-lg);
  background: var(--tub-surface);
  color: var(--tub-text);
  box-shadow: var(--tub-shadow-md);
}
.pin-dialog::backdrop {
  background: var(--tub-overlay);
}
.pin-dialog__form {
  display: grid;
  gap: var(--tub-space-4);
}
.pin-dialog__title {
  font-size: var(--tub-text-lg);
  font-weight: 600;
}
.pin-dialog__summary {
  margin-top: var(--tub-space-1);
  color: var(--tub-text-muted);
}
.pin-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
}
</style>
