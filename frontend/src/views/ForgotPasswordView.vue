<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { UiButton, UiInput, UiCard, UiAlert } from '../components/ui'

const authStore = useAuthStore()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = ref('')
const submitted = ref(false)
const loading = ref(false)
const sent = ref(false)

const normalizedEmail = computed(() => email.value.trim().toLowerCase())
const emailValid = computed(() => EMAIL_RE.test(normalizedEmail.value))
const emailError = computed(() =>
  submitted.value && !emailValid.value ? 'Introdueix un correu vàlid.' : ''
)

async function handleSubmit() {
  submitted.value = true
  if (!emailValid.value) return

  loading.value = true
  try {
    await authStore.requestPasswordReset(normalizedEmail.value)
  } finally {
    // Sempre el mateix avís, hi hagi error o no
    sent.value = true
    loading.value = false
  }
}
</script>

<template>
  <main class="panel">
    <UiCard class="card">
      <section v-if="sent">
        <h2>Revisa el teu correu</h2>
        <UiAlert variant="success">
          Si el correu existeix al nostre sistema, rebràs un enllaç de recuperació
        </UiAlert>
        <RouterLink
          to="/login"
          class="back"
        >
          Tornar a iniciar sessió
        </RouterLink>
      </section>

      <form
        v-else
        novalidate
        @submit.prevent="handleSubmit"
      >
        <h2>Has oblidat la contrasenya?</h2>
        <p class="muted">
          Introdueix el teu correu i t'enviarem un enllaç per restablir-la.
        </p>

        <UiInput
          v-model="email"
          label="Correu electrònic"
          type="email"
          autocomplete="email"
          placeholder="nom@exemple.com"
          :error="emailError"
        />

        <UiButton
          type="submit"
          size="lg"
          block
          :loading="loading"
        >
          {{ loading ? 'Enviant…' : 'Enviar enllaç' }}
        </UiButton>

        <RouterLink
          to="/login"
          class="back"
        >
          Tornar a iniciar sessió
        </RouterLink>
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
.back {
  display: block;
  margin-top: var(--tub-space-4);
  text-align: center;
}
</style>