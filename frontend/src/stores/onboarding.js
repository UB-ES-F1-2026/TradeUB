import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiRequest } from '../services/api';
import { STEP_STATUS, firstPendingStep, progressPercent } from '../utils/onboarding';

// Passos de l'onboarding en ordre: cadascun correspon a una user story (US2.2, US2.3 i US2.4)
export const ONBOARDING_STEPS = [
    {
        id: 'dades-personals',
        title: 'Dades personals',
        description: 'Nom, data de naixement, adreça i residència fiscal.',
    },
    {
        id: 'questionari-inversor',
        title: "Qüestionari d'experiència inversora",
        description: 'Cinc preguntes per conèixer el teu perfil com a inversor.',
    },
    {
        id: 'verificacio-identitat',
        title: 'Verificació del DNI i termes',
        description: 'Puja el document (simulat) i accepta les condicions del servei.',
    },
];

export const useOnboardingStore = defineStore('onboarding', () => {
    // Estat de cada pas tal com el retorna el backend: { [idPas]: 'pendent' | 'completat' }.
    // Està buit (tots pendents) fins que es crida load()
    const statuses = ref({});

    const steps = computed(() =>
        ONBOARDING_STEPS.map((step) => ({
            ...step,
            route: { name: 'onboarding-step', params: { step: step.id } },
            status: statuses.value[step.id] === STEP_STATUS.COMPLETED ? STEP_STATUS.COMPLETED : STEP_STATUS.PENDING,
        }))
    );

    const progress = computed(() => progressPercent(steps.value));
    const nextStep = computed(() => firstPendingStep(steps.value));
    const isComplete = computed(() => nextStep.value === null);

    const getStep = (id) => steps.value.find((s) => s.id === id) ?? null;

    // Demana l'estat dels passos al backend (GET /users/me), que el dedueix de la taula profiles.
    // El frontend ja no el desa: cada pas el completa el backend quan rep les dades del seu formulari
    const load = async () => {
        const data = await apiRequest('/users/me');
        const backendSteps = data?.onboarding?.steps ?? [];
        statuses.value = Object.fromEntries(backendSteps.map((step) => [step.id, step.status]));
    };

    return { steps, progress, nextStep, isComplete, getStep, load };
});
