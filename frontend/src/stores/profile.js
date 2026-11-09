import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { apiGet, apiPost } from '../services/api';
import { useAuthStore } from './auth';

// Dades personals de l'usuari. Viuen a la taula profiles: el frontend les llegeix i les envia al backend, no les desa
export const useProfileStore = defineStore('profile', () => {
    const authStore = useAuthStore();

    const perfil = ref({});
    const loading = ref(false);
    const error = ref('');

    const reset = () => {
        perfil.value = {};
        loading.value = false;
        error.value = '';
    };

    // Llegeix el perfil del backend (GET /users/me); si falla, mostra l'error i no es toca el que ja hi havia
    const load = async () => {
        error.value = '';
        loading.value = true;
        try {
            const data = await apiGet('/users/me');
            perfil.value = data?.perfil ?? {};
        } catch {
            error.value = "No s'han pogut carregar les dades personals.";
        } finally {
            loading.value = false;
        }
    };

    // Envia les dades personals al backend, que les valida i les desa. Si les rebutja, llança l'ApiError
    const savePersonalData = async (data) => {
        const saved = await apiPost('/profile/personal-data', data);
        perfil.value = { ...perfil.value, ...data };
        return saved;
    };

    // Envia les respostes del qüestionari; el backend calcula el perfil, el desa i el retorna
    const saveInvestorQuestionnaire = async (answers) => {
        const { profile } = await apiPost('/profile/investor-questionnaire', answers);
        perfil.value = { ...perfil.value, perfil_inversor: profile };
        return profile;
    };

    // En tancar sessió o canviar d'usuari no es pot quedar el perfil de l'anterior
    watch(() => authStore.user?.id, (id, previousId) => {
        if (id !== previousId) reset();
    });

    return { perfil, loading, error, load, savePersonalData, saveInvestorQuestionnaire, reset };
});
