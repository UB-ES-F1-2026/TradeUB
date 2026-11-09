<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ONBOARDING_STEPS, useOnboardingStore } from '../stores/onboarding'
import { acceptTerms, fetchVerification, isIdentityVerified } from '../services/verification'
import { TERMS_SECTIONS } from '../utils/terms'
import { UiAlert, UiButton, UiCard, UiCheckbox } from '../components/ui'

// Acceptació dels termes (US2.4): s'hi arriba des del pas de verificació del DNI, un cop verificat.
// Com que l'URL es pot escriure a mà o recarregar, en entrar es torna a comprovar l'estat al backend
const STEP_ID = 'verificacio-identitat'
const DNI_STEP = { name: 'onboarding-step', params: { step: STEP_ID } }

const router = useRouter()
const onboarding = useOnboardingStore()

const position = ONBOARDING_STEPS.findIndex((s) => s.id === STEP_ID) + 1

const loading = ref(true)
const loadError = ref('')
const verificacio = ref(null)
const readToEnd = ref(false)
const accepted = ref(false)
const submitting = ref(false)
const submitError = ref('')

const canSubmit = computed(() => readToEnd.value && accepted.value)

// Després d'acceptar (o si ja estaven acceptats) es torna a demanar el progrés i es va al següent pas pendent
async function leave() {
  try {
    await onboarding.load()
  } catch {
    // Si no es pot carregar el progrés, la benvinguda el tornarà a demanar
  }
  await router.replace(onboarding.nextStep?.route ?? { name: 'onboarding' })
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    verificacio.value = await fetchVerification()
  } catch {
    loadError.value = "No s'ha pogut comprovar l'estat de la verificació."
    loading.value = false
    return
  }
  if (!isIdentityVerified(verificacio.value)) {
    await router.replace(DNI_STEP)
    return
  }
  if (verificacio.value.termes_acceptats) {
    await leave()
    return
  }
  loading.value = false
}

onMounted(load)

// La casella s'activa quan el final del text és visible dins la caixa, tant si s'hi arriba fent scroll
// com si el text hi cap sencer. IntersectionObserver ho detecta en els dos casos
const termsBox = ref(null)
const termsEnd = ref(null)
let observer = null

function stopObserving() {
  observer?.disconnect()
  observer = null
}

watch(termsEnd, (marker) => {
  stopObserving()
  if (!marker || readToEnd.value) return
  observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    readToEnd.value = true
    stopObserving()
  }, { root: termsBox.value })
  observer.observe(marker)
}, { flush: 'post' })

onBeforeUnmount(stopObserving)

async function submit() {
  if (!canSubmit.value) return
  submitError.value = ''
  submitting.value = true
  try {
    await acceptTerms(verificacio.value.termes_versio_vigent)
  } catch (e) {
    // Els 409 del backend ja porten un missatge en català (identitat no verificada o versió antiga)
    submitError.value = e?.status === 409
      ? e.message
      : "No s'han pogut acceptar els termes. Torna-ho a provar."
    submitting.value = false
    return
  }
  await leave()
  submitting.value = false
}
</script>

<template>
  <div class="terms-page">
    <UiCard class="terms-page__card">
      <span class="eyebrow">Pas {{ position }} de {{ ONBOARDING_STEPS.length }}</span>
      <h1 class="terms-page__title">
        Termes i condicions
      </h1>

      <p
        v-if="loading && !loadError"
        class="terms-page__muted"
      >
        Comprovant l'estat de la verificació…
      </p>

      <template v-else-if="loadError">
        <UiAlert variant="error">
          {{ loadError }}
        </UiAlert>
        <div class="terms-page__actions">
          <UiButton
            variant="secondary"
            @click="router.push(DNI_STEP)"
          >
            Torna
          </UiButton>
          <UiButton @click="load">
            Torna-ho a provar
          </UiButton>
        </div>
      </template>

      <template v-else>
        <p class="terms-page__muted">
          Llegeix les condicions del servei fins al final per poder-les acceptar.
          <span
            v-if="verificacio?.termes_versio_vigent"
            class="tabular"
          >Versió {{ verificacio.termes_versio_vigent }}.</span>
        </p>

        <div
          ref="termsBox"
          class="terms-page__box"
          tabindex="0"
          role="region"
          aria-label="Text dels termes i condicions"
          data-test="terms-box"
        >
          <section
            v-for="section in TERMS_SECTIONS"
            :key="section.title"
            class="terms-page__section"
          >
            <h2 class="terms-page__section-title">
              {{ section.title }}
            </h2>
            <p
              v-for="paragraph in section.paragraphs"
              :key="paragraph"
            >
              {{ paragraph }}
            </p>
          </section>
          <div
            ref="termsEnd"
            class="terms-page__end"
            data-test="terms-end"
          />
        </div>

        <UiCheckbox
          v-model="accepted"
          :disabled="!readToEnd"
          label="He llegit i accepto els termes i condicions"
          :hint="readToEnd ? '' : 'Arriba al final del text per poder acceptar-los.'"
          data-test="terms-checkbox"
        />

        <UiAlert
          v-if="submitError"
          variant="error"
        >
          {{ submitError }}
        </UiAlert>

        <div class="terms-page__actions">
          <UiButton
            variant="secondary"
            @click="router.push(DNI_STEP)"
          >
            Torna
          </UiButton>
          <UiButton
            :disabled="!canSubmit"
            :loading="submitting"
            data-test="terms-submit"
            @click="submit"
          >
            Accepta i finalitza
          </UiButton>
        </div>
      </template>
    </UiCard>
  </div>
</template>

<style scoped>
.terms-page {
  display: flex;
  min-height: 100vh;
  padding: var(--tub-space-7) var(--tub-space-5);
  background: var(--tub-bg);
}
.terms-page__card {
  display: grid;
  gap: var(--tub-space-3);
  width: 100%;
  max-width: 640px;
  margin: auto;
}
.terms-page__title {
  font-size: var(--tub-text-xl);
}
.terms-page__muted {
  color: var(--tub-text-muted);
}
.terms-page__box {
  max-height: 22rem;
  overflow-y: auto;
  padding: var(--tub-space-4);
  border: 1px solid var(--tub-border);
  border-radius: var(--tub-radius-md);
  background: var(--tub-surface-2);
  color: var(--tub-text-2);
  font-size: var(--tub-text-sm);
}
.terms-page__box:focus-visible {
  outline: none;
  border-color: var(--tub-primary);
  box-shadow: 0 0 0 4px var(--tub-ring);
}
.terms-page__section + .terms-page__section {
  margin-top: var(--tub-space-4);
}
.terms-page__section p {
  margin-top: var(--tub-space-2);
}
.terms-page__section-title {
  font-size: var(--tub-text-sm);
  color: var(--tub-text);
}
.terms-page__end {
  height: 1px;
}
.terms-page__actions {
  display: flex;
  justify-content: space-between;
  gap: var(--tub-space-3);
}

@media (max-width: 900px) {
  .terms-page {
    padding: var(--tub-space-6) var(--tub-space-4);
  }
  .terms-page__box {
    max-height: 55vh;
  }
}
</style>
