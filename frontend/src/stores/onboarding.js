import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useAuthStore } from './auth';
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
    const authStore = useAuthStore();

    // L'estat de cada pas es desa al núvol, a user_metadata.onboarding de Supabase: { [idPas]: 'completat' }
    const saved = computed(() => authStore.user?.user_metadata?.onboarding ?? {});

    const steps = computed(() =>
        ONBOARDING_STEPS.map((step) => ({
            ...step,
            status: saved.value[step.id] === STEP_STATUS.COMPLETED ? STEP_STATUS.COMPLETED : STEP_STATUS.PENDING,
        }))
    );

    const progress = computed(() => progressPercent(steps.value));
    const nextStep = computed(() => firstPendingStep(steps.value));
    const isComplete = computed(() => nextStep.value === null);

    const getStep = (id) => steps.value.find((s) => s.id === id) ?? null;

    return { steps, progress, nextStep, isComplete, getStep };
});
