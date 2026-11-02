<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { UiAlert, UiButton, UiCard, UiInput, UiLogo, UiSelect } from '../components/ui'
import { FISCAL_COUNTRIES } from '../utils/countries'

const authStore = useAuthStore()
const router = useRouter()

// Contracte amb el panell d'onboarding (US2.1): l'estat dels passos viu a user_metadata.onboarding
const ONBOARDING_STEP_ID = 'dades-personals'
const STEP_COMPLETED = 'completat'

const REQUIRED_ERROR = 'Cal omplir tots els camps obligatoris.'

// Si l'usuari ja havia desat dades, el formulari les mostra per poder-les revisar
const meta = authStore.user?.user_metadata ?? {}
const form = reactive({
  first_name: meta.first_name ?? '',
  last_name: meta.last_name ?? '',
  birthdate: meta.birthdate ?? '',
  phone: meta.phone ?? '',
  nif: meta.nif ?? '',
  street: meta.street ?? '',
  postal_code: meta.postal_code ?? '',
  city: meta.city ?? '',
  tax_country: meta.tax_country ?? '',
})

const loading = ref(false)
const submitted = ref(false)
const saveError = ref('')

const isEmpty = (value) => !String(value).trim()
const missingFields = computed(() => Object.keys(form).filter((key) => isEmpty(form[key])))

// Només es mostren els errors un cop l'usuari ha intentat desar
const errors = computed(() =>
  Object.fromEntries(
    Object.keys(form).map((key) => [key, submitted.value && isEmpty(form[key]) ? 'Camp obligatori.' : ''])
  )
)
const alertMessage = computed(() =>
  submitted.value && missingFields.value.length ? REQUIRED_ERROR : saveError.value
)

function buildPayload() {
  const street = form.street.trim()
  const postalCode = form.postal_code.trim()
  const city = form.city.trim()

  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    birthdate: form.birthdate,
    phone: form.phone.trim(),
    nif: form.nif.trim().toUpperCase(),
    street,
    postal_code: postalCode,
    city,
    tax_country: form.tax_country,
    // L'adreça en una sola línia és la que mostra el perfil
    address: `${street}, ${postalCode} ${city}`,
    onboarding: { ...(meta.onboarding ?? {}), [ONBOARDING_STEP_ID]: STEP_COMPLETED },
  }
}

async function handleSubmit() {
  submitted.value = true
  saveError.value = ''
  if (missingFields.value.length) return

  loading.value = true
  try {
    await authStore.updateUserMetadata(buildPayload())
    // Torna al panell d'onboarding; mentre no existeixi, a l'espai de perfil on es veuen les dades
    await router.replace({ name: router.hasRoute('onboarding') ? 'onboarding' : 'perfil' })
  } catch {
    saveError.value = "No s'han pogut desar les dades. Torna-ho a provar."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="dades">
    <div class="dades__content">
      <UiLogo class="dades__logo" />

      <UiCard>
        <header class="dades__head">
          <span class="eyebrow">Pas 1 de 3</span>
          <h1 class="dades__title">
            Dades personals
          </h1>
          <p class="dades__subtitle">
            Les necessitem per complir els requisits legals i verificar el teu compte.
            Tots els camps són obligatoris.
          </p>
        </header>

        <form
          novalidate
          @submit.prevent="handleSubmit"
        >
          <h2 class="eyebrow dades__section">
            Identitat
          </h2>
          <div class="dades__row">
            <UiInput
              v-model="form.first_name"
              label="Nom"
              autocomplete="given-name"
              :error="errors.first_name"
            />
            <UiInput
              v-model="form.last_name"
              label="Cognoms"
              autocomplete="family-name"
              :error="errors.last_name"
            />
          </div>
          <div class="dades__row">
            <UiInput
              v-model="form.birthdate"
              label="Data de naixement"
              type="date"
              autocomplete="bday"
              :error="errors.birthdate"
            />
            <UiInput
              v-model="form.phone"
              label="Telèfon"
              type="tel"
              autocomplete="tel"
              placeholder="600 000 000"
              :error="errors.phone"
            />
          </div>
          <UiInput
            v-model="form.nif"
            label="NIF/NIE"
            placeholder="12345678Z"
            hint="El número del teu DNI o NIE."
            :error="errors.nif"
          />

          <h2 class="eyebrow dades__section">
            Domicili i residència fiscal
          </h2>
          <UiInput
            v-model="form.street"
            label="Carrer i número"
            autocomplete="street-address"
            :error="errors.street"
          />
          <div class="dades__row">
            <UiInput
              v-model="form.postal_code"
              label="Codi postal"
              autocomplete="postal-code"
              inputmode="numeric"
              :error="errors.postal_code"
            />
            <UiInput
              v-model="form.city"
              label="Població"
              autocomplete="address-level2"
              :error="errors.city"
            />
          </div>
          <UiSelect
            v-model="form.tax_country"
            label="País de residència fiscal"
            placeholder="Selecciona un país"
            :options="FISCAL_COUNTRIES"
            :error="errors.tax_country"
          />

          <UiAlert
            v-if="alertMessage"
            variant="error"
          >
            {{ alertMessage }}
          </UiAlert>

          <UiButton
            type="submit"
            size="lg"
            block
            :loading="loading"
          >
            {{ loading ? 'Desant…' : 'Desa i continua' }}
          </UiButton>
        </form>
      </UiCard>
    </div>
  </div>
</template>

<style scoped>
.dades {
  display: flex;
  min-height: 100vh;
  padding: var(--tub-space-7) var(--tub-space-5);
  background: var(--tub-bg);
}
/* margin: auto centra la targeta sense tallar-ne la part de dalt si és més alta que la pantalla */
.dades__content {
  display: grid;
  gap: var(--tub-space-5);
  width: 100%;
  max-width: 640px;
  margin: auto;
}
.dades__logo {
  justify-self: center;
}
.dades__head {
  display: grid;
  gap: var(--tub-space-1);
  margin-bottom: var(--tub-space-5);
}
.dades__title {
  font-size: var(--tub-text-xl);
}
.dades__subtitle {
  color: var(--tub-text-muted);
  line-height: 1.5;
}
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

@media (max-width: 900px) {
  .dades {
    padding: var(--tub-space-6) var(--tub-space-4);
  }
  .dades__row {
    grid-template-columns: 1fr;
  }
}
</style>
