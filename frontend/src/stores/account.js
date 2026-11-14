import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { apiGet } from '../services/api';
import { useAuthStore } from './auth';

// Saldo simulat del compte virtual. El backend el llegeix de la taula accounts (només lectura per a l'usuari)
export const useAccountStore = defineStore('account', () => {
    const authStore = useAuthStore();

    const balance = ref(null);
    const currency = ref('EUR');
    const updatedAt = ref(null);
    const loading = ref(false);
    const error = ref('');

    const hasBalance = computed(() => balance.value !== null);

    const reset = () => {
        balance.value = null;
        currency.value = 'EUR';
        updatedAt.value = null;
        loading.value = false;
        error.value = '';
    };

    // Demana el saldo al backend; si falla es manté l'últim valor conegut
    const fetchBalance = async () => {
        error.value = '';
        loading.value = true;
        try {
            const data = await apiGet('/account/balance');
            // PostgREST pot retornar els numeric com a text
            balance.value = Number(data.balance);
            currency.value = data.currency ?? 'EUR';
            updatedAt.value = data.updated_at ?? null;
        } catch (e) {
            // Sense identitat verificada ni termes acceptats el backend no dona el saldo
            if (e.status === 403) {
                balance.value = null;
                error.value = e.message;
                return;
            }
            error.value = e.status === 404
                ? 'Encara no tens cap compte virtual.'
                : "No s'ha pogut carregar el saldo. Torna-ho a provar.";
        } finally {
            loading.value = false;
        }
    };

    // En tancar sessió o canviar d'usuari no es pot quedar el saldo de l'anterior
    watch(() => authStore.user?.id, (id, previousId) => {
        if (id !== previousId) reset();
    });

    return { balance, currency, updatedAt, loading, error, hasBalance, fetchBalance, reset };
});
