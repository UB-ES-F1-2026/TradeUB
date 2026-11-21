<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useProfileStore } from '../stores/profile'
import { ApiError } from '../services/api'
import { UiAlert, UiButton, UiInput, UiSelect } from './ui'
import { FISCAL_COUNTRIES } from '../utils/countries'
import { isValidNifNie, NIF_NIE_ERROR } from '../utils/nifNie'

// Formulari del pas "Dades personals" de l'onboarding. Envia les dades al backend, que les valida i les desa;
// en acabar avisa amb "saved" perquè el pas torni a demanar l'estat de l'onboarding.
// Amb mode="edit" és el mode edició del perfil (US4.1): només mostra i envia els camps que es poden editar,
// i "Cancel·la" avisa amb "cancel"
const props = defineProps({
  mode: { type: String, default: 'onboarding' }, // onboarding | edit
})
const emit = defineEmits(['saved', 'cancel'])

const profile = useProfileStore()

const REQUIRED_ERROR = 'Cal omplir tots els camps obligatoris.'
const SAVE_ERROR = "No s'han pogut desar les dades. Torna-ho a provar."
// Camps editables des del perfil. El NIF/NIE, la data de naixement i la residència fiscal els ha verificat el KYC
const EDITABLE_FIELDS = ['nom', 'cognoms', 'telefon', 'carrer', 'codi_postal', 'poblacio']

const isEdit = computed(() => props.mode === 'edit')

const form = reactive({
  nom: '',
  cognoms: '',
  data_naixement: '',
  telefon: '',
  nif: '',
  carrer: '',
  codi_postal: '',
  poblacio: '',
  residencia_fiscal: '',
})

const loading = ref(false)
const submitted = ref(false)
const saveError = ref('')
// Error del NIF/NIE que ha retornat el backend; es mostra al camp i s'esborra quan l'usuari el canvia
const nifServerError = ref('')

// Si l'usuari ja havia desat dades, el formulari les mostra per poder-les revisar.
// Al perfil ja estan carregades: no cal tornar-les a demanar
onMounted(async () => {
  if (!isEdit.value) await profile.load()
  for (const key of Object.keys(form)) {
    if (!form[key] && profile.perfil[key]) form[key] = profile.perfil[key]
  }
})

watch(() => form.nif, () => {
  nifServerError.value = ''
})

const isEmpty = (value) => !String(value).trim()
// Camps que es mostren i s'envien en aquest mode
const fields = computed(() => (isEdit.value ? EDITABLE_FIELDS : Object.keys(form)))
const missingFields = computed(() => fields.value.filter((key) => isEmpty(form[key])))

// Només es mostren els errors un cop l'usuari ha intentat desar
function fieldError(key) {
  if (!submitted.value || !fields.value.includes(key)) return ''
  if (isEmpty(form[key])) return 'Camp obligatori.'
  if (key !== 'nif') return ''
  // Avís previ per a l'usuari; la validació definitiva la fa el backend
  if (!isValidNifNie(form.nif)) return NIF_NIE_ERROR
  return nifServerError.value
}
const errors = computed(() =>
  Object.fromEntries(Object.keys(form).map((key) => [key, fieldError(key)]))
)
const alertMessage = computed(() =>
  submitted.value && missingFields.value.length ? REQUIRED_ERROR : saveError.value
)

function buildPayload() {
  return {
    nom: form.nom.trim(),
    cognoms: form.cognoms.trim(),
    data_naixement: form.data_naixement,
    telefon: form.telefon.trim(),
    nif: form.nif.trim().toUpperCase(),
    carrer: form.carrer.trim(),
    codi_postal: form.codi_postal.trim(),
    poblacio: form.poblacio.trim(),
    residencia_fiscal: form.residencia_fiscal,
  }
}

// Al perfil, el backend retorna el motiu exacte (camps no editables, pas no completat, format); qualsevol altre
// error (500, xarxa, la llista de Pydantic) es mostra com l'error general
function editErrorMessage(e) {
  const known = e instanceof ApiError && [403, 409, 422].includes(e.status) && e.message !== 'Error del servidor'
  return known ? e.message : SAVE_ERROR
}

async function handleEdit() {
  submitted.value = true
  saveError.value = ''
  if (missingFields.value.length) return

  loading.value = true
  try {
    const payload = Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, form[key].trim()]))
    await profile.updatePersonalData(payload)
    emit('saved')
  } catch (e) {
    // El formulari conserva el que s'ha escrit
    saveError.value = editErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (isEdit.value) return handleEdit()
  submitted.value = true
  saveError.value = ''
  nifServerError.value = ''
  if (missingFields.value.length || !isValidNifNie(form.nif)) return

  loading.value = true
  try {
    await profile.savePersonalData(buildPayload())
    emit('saved')
  } catch (e) {
    if (e instanceof ApiError && e.status === 422 && e.message === NIF_NIE_ERROR) {
      nifServerError.value = e.message
    } else {
      saveError.value = SAVE_ERROR
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form
    novalidate
    @submit.prevent="handleSubmit"
  >
    <h2 class="eyebrow dades__section">
      Identitat
    </h2>
    <div class="dades__row">
      <UiInput
        v-model="form.nom"
        label="Nom"
        autocomplete="given-name"
        :error="errors.nom"
      />
      <UiInput
        v-model="form.cognoms"
        label="Cognoms"
        autocomplete="family-name"
        :error="errors.cognoms"
      />
    </div>
    <div class="dades__row">
      <UiInput
        v-if="!isEdit"
        v-model="form.data_naixement"
        label="Data de naixement"
        type="date"
        autocomplete="bday"
        :error="errors.data_naixement"
      />
      <UiInput
        v-model="form.telefon"
        label="Telèfon"
        type="tel"
        autocomplete="tel"
        placeholder="600 000 000"
        :error="errors.telefon"
      />
    </div>
    <UiInput
      v-if="!isEdit"
      v-model="form.nif"
      label="NIF/NIE"
      placeholder="12345678Z"
      hint="El número del teu DNI o NIE."
      :error="errors.nif"
    />

    <h2 class="eyebrow dades__section">
      {{ isEdit ? 'Domicili' : 'Domicili i residència fiscal' }}
    </h2>
    <UiInput
      v-model="form.carrer"
      label="Carrer i número"
      autocomplete="street-address"
      :error="errors.carrer"
    />
    <div class="dades__row">
      <UiInput
        v-model="form.codi_postal"
        label="Codi postal"
        autocomplete="postal-code"
        inputmode="numeric"
        :error="errors.codi_postal"
      />
      <UiInput
        v-model="form.poblacio"
        label="Població"
        autocomplete="address-level2"
        :error="errors.poblacio"
      />
    </div>
    <UiSelect
      v-if="!isEdit"
      v-model="form.residencia_fiscal"
      label="País de residència fiscal"
      placeholder="Selecciona un país"
      :options="FISCAL_COUNTRIES"
      :error="errors.residencia_fiscal"
    />

    <UiAlert
      v-if="alertMessage"
      variant="error"
    >
      {{ alertMessage }}
    </UiAlert>

    <div
      v-if="isEdit"
      class="dades__actions"
    >
      <UiButton
        type="submit"
        :loading="loading"
      >
        {{ loading ? 'Desant…' : 'Desa' }}
      </UiButton>
      <UiButton
        variant="ghost"
        :disabled="loading"
        @click="emit('cancel')"
      >
        Cancel·la
      </UiButton>
    </div>
    <UiButton
      v-else
      type="submit"
      size="lg"
      block
      :loading="loading"
    >
      {{ loading ? 'Desant…' : 'Desa i continua' }}
    </UiButton>
  </form>
</template>

<style scoped>
.dades__section {
  margin: var(--tub-space-5) 0 var(--tub-space-3);
}
.dades__section:first-of-type {
  margin-top: 0;
}
.dades__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--tub-space-4);
}

.dades__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tub-space-3);
  margin-top: var(--tub-space-4);
}

@media (max-width: 900px) {
  .dades__row {
    grid-template-columns: 1fr;
  }
  .dades__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
