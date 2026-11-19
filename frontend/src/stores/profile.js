import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { apiGet, apiPost } from '../services/api';
import { useAuthStore } from './auth';

// Dades personals de l'usuari. Viuen a la taula profiles: el frontend les llegeix i les envia al backend, no les desa
export const useProfileStore = defineStore('profile', () => {
    const authStore = useAuthStore();

    const perfil = ref({});
    const loading = ref(false);
    const error = ref('');
    // PIN de seguretat (US1.5): null fins que el backend diu si n'hi ha un de configurat
    const pinConfigured = ref(null);
    const pinError = ref('');

    const reset = () => {
        perfil.value = {};
        loading.value = false;
        error.value = '';
        pinConfigured.value = null;
        pinError.value = '';
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

    // El backend no retorna mai el PIN ni el hash, només si n'hi ha un de configurat (GET /profile/pin)
    const hasPin = computed(() => pinConfigured.value === true);

    const loadPinStatus = async () => {
        pinError.value = '';
        try {
            const data = await apiGet('/profile/pin');
            pinConfigured.value = data?.configurat === true;
        } catch {
            pinError.value = "No s'ha pogut comprovar el PIN. Torna-ho a provar.";
        }
    };

    // Crea el PIN o, si ja n'hi ha un, el canvia (cal el PIN actual). Si el backend el rebutja, llança l'ApiError
    const savePin = async ({ pin, currentPin }) => {
        const body = currentPin ? { pin, pin_actual: currentPin } : { pin };
        await apiPost('/profile/pin', body);
        pinConfigured.value = true;
    };

    // En tancar sessió o canviar d'usuari no es pot quedar el perfil de l'anterior
    watch(() => authStore.user?.id, (id, previousId) => {
        if (id !== previousId) reset();
    });

    return { perfil, loading, error, pinConfigured, pinError, hasPin, load, loadPinStatus,savePersonalData, saveInvestorQuestionnaire, savePin, reset };
});
