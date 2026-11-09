<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useVerificationStore } from '../stores/verification'
import { UiAlert, UiBadge, UiButton, UiFileInput } from './ui'
import {
  ACCEPTED_FILES,
  DOCUMENT_FORMAT_ERROR,
  VERIFICATION_STATUS,
  isAllowedImage,
} from '../utils/identityDocument'

// Pujada simulada del DNI (US2.4). La imatge només es valida i es previsualitza al navegador: al backend
// només se li avisa que s'ha enviat, i és ell qui decideix quan passa d'"En revisió" a "Verificat"
const verification = useVerificationStore()

const STATUS_BADGES = {
  [VERIFICATION_STATUS.PENDING]: { variant: 'neutral', label: 'Pendent' },
  [VERIFICATION_STATUS.IN_REVIEW]: { variant: 'info', label: 'En revisió' },
  [VERIFICATION_STATUS.VERIFIED]: { variant: 'success', label: 'Verificat' },
}

const file = ref(null)
const previewUrl = ref('')
const formatError = ref('')
const submitError = ref('')
const submitting = ref(false)

const badge = computed(() => STATUS_BADGES[verification.status])
const errorMessage = computed(() => submitError.value || verification.error)

onMounted(() => verification.load())

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

onBeforeUnmount(clearPreview)

// UiFileInput emet el fitxer triat: només es guarda si és JPG o PNG, i mai surt del navegador
function onFileChange(selected) {
  clearPreview()
  submitError.value = ''
  if (!isAllowedImage(selected)) {
    file.value = null
    formatError.value = DOCUMENT_FORMAT_ERROR
    return
  }
  file.value = selected
  formatError.value = ''
  previewUrl.value = URL.createObjectURL(selected)
}

async function submit() {
  if (!file.value) return
  submitError.value = ''
  submitting.value = true
  try {
    await verification.submitDocument()
  } catch {
    submitError.value = "No s'ha pogut enviar el document. Torna-ho a provar."
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="dni">
    <div class="dni__header">
      <h2 class="eyebrow">
        Document d'identitat
      </h2>
      <UiBadge
        v-if="!verification.loading"
        :variant="badge.variant"
        data-test="dni-status"
      >
        {{ badge.label }}
      </UiBadge>
    </div>

    <p
      v-if="verification.loading"
      class="dni__muted"
    >
      Carregant l'estat de la verificació…
    </p>

    <template v-else>
      <UiFileInput
        v-if="verification.isPending"
        label="Selecciona una foto del teu DNI"
        :accept="ACCEPTED_FILES"
        :file-name="file?.name"
        :error="formatError"
        hint="JPG o PNG. És una verificació simulada: la imatge no surt del teu navegador."
        data-test="dni-input"
        @change="onFileChange"
      >
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt="Previsualització del document"
          class="dni__preview"
          data-test="dni-preview"
        >
      </UiFileInput>

      <img
        v-else-if="previewUrl"
        :src="previewUrl"
        alt="Previsualització del document"
        class="dni__preview"
        data-test="dni-preview"
      >

      <UiAlert
        v-if="verification.isInReview"
        variant="info"
      >
        <template v-if="verification.checking">
          Comprovant l'estat de la verificació…
        </template>
        <template v-else>
          Estem revisant el document. Temps restant:
          <span
            class="tabular"
            data-test="dni-countdown"
          >{{ verification.secondsLeft }} s</span>
        </template>
      </UiAlert>

      <UiAlert
        v-else-if="verification.isVerified"
        variant="success"
      >
        Identitat verificada.
      </UiAlert>

      <UiAlert
        v-if="errorMessage"
        variant="error"
      >
        {{ errorMessage }}
      </UiAlert>

      <UiButton
        v-if="verification.isPending"
        block
        :disabled="!file"
        :loading="submitting"
        data-test="dni-submit"
        @click="submit"
      >
        {{ submitting ? 'Enviant…' : 'Envia per verificar' }}
      </UiButton>
      <UiButton
        v-else-if="verification.error"
        variant="secondary"
        block
        @click="verification.load()"
      >
        Torna-ho a comprovar
      </UiButton>
    </template>
  </section>
</template>

<style scoped>
.dni {
  display: grid;
  gap: var(--tub-space-3);
}
.dni__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tub-space-3);
}
.dni__muted {
  color: var(--tub-text-muted);
  font-size: var(--tub-text-sm);
}
.dni__preview {
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface-2);
}
</style>
