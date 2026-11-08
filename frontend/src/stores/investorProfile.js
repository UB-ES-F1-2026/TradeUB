import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useAuthStore } from './auth';
import { PROFILE_LABELS, calculateInvestorProfile } from '../utils/investorProfile';

export const useInvestorProfileStore = defineStore('investorProfile', () => {
    const authStore = useAuthStore();

    // El perfil es desa al núvol, a user_metadata.investor_profile de Supabase:
    // { profile, score, answers, completed_at }. Aquí es llegeix per tenir-lo a la memòria de l'app
    const saved = computed(() => authStore.user?.user_metadata?.investor_profile ?? null);

    const profile = computed(() => saved.value?.profile ?? null);
    const profileLabel = computed(() => PROFILE_LABELS[profile.value] ?? '');
    const hasProfile = computed(() => profile.value !== null);

    // Avalua les 5 respostes, assigna el perfil i el desa. Retorna el perfil assignat
    const submitAnswers = async (answers) => {
        const result = calculateInvestorProfile(answers);
        if (!result) throw new Error('Cal respondre totes les preguntes');

        await authStore.updateUserMetadata({
            investor_profile: { ...result, answers, completed_at: new Date().toISOString() },
        });
        return result.profile;
    };

    return { profile, profileLabel, hasProfile, submitAnswers };
});
