import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { apiGet } from '../services/api';
import { ALL_MOVEMENT_TYPES } from '../utils/movements';
import { useAuthStore } from './auth';

export const MOVEMENTS_PAGE_SIZE = 20;
export const DATE_RANGE_ERROR = "La data d'inici no pot ser posterior a la data de fi.";
const LOAD_ERROR = "No s'ha pogut carregar l'historial. Torna-ho a provar.";

// Historial de moviments d'efectiu (US3.5): filtres, pàgina actual i files de GET /account/movements.
// El backend ordena del més nou al més antic i diu amb has_more si hi ha pàgina següent
export const useMovementsStore = defineStore('movements', () => {
    const authStore = useAuthStore();

    const movements = ref([]);
    const hasMore = ref(false);
    const page = ref(1);
    // Les dates són "AAAA-MM-DD" (el valor d'un input type="date"), el format que espera el backend
    const filters = reactive({ from: '', to: '', type: ALL_MOVEMENT_TYPES });
    const loading = ref(false);
    const error = ref('');

    // Les dates en format ISO es poden comparar com a text
    const dateRangeError = computed(() =>
        filters.from && filters.to && filters.from > filters.to ? DATE_RANGE_ERROR : ''
    );

    // Cada petició té un número: si els filtres canvien abans que arribi la resposta, la vella s'ignora
    let lastRequest = 0;

    const buildQuery = () => {
        const params = new URLSearchParams({
            limit: String(MOVEMENTS_PAGE_SIZE),
            offset: String((page.value - 1) * MOVEMENTS_PAGE_SIZE),
        });
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.type !== ALL_MOVEMENT_TYPES) params.set('type', filters.type);
        return params.toString();
    };

    const fetchMovements = async () => {
        const request = ++lastRequest;
        error.value = '';
        // Amb el rang de dates invertit no es crida el backend; l'error es mostra al camp
        if (dateRangeError.value) {
            movements.value = [];
            hasMore.value = false;
            loading.value = false;
            return;
        }
        loading.value = true;
        try {
            const data = await apiGet(`/account/movements?${buildQuery()}`);
            if (request !== lastRequest) return;
            movements.value = data.movements ?? [];
            hasMore.value = Boolean(data.has_more);
        } catch (e) {
            if (request !== lastRequest) return;
            movements.value = [];
            hasMore.value = false;
            // 422 (dates) i 403 (no verificat) porten un missatge pensat per a l'usuari
            error.value = e.status === 422 || e.status === 403 ? e.message : LOAD_ERROR;
        } finally {
            if (request === lastRequest) loading.value = false;
        }
    };

    // Cada canvi de filtre torna a la primera pàgina
    const applyFilters = () => {
        page.value = 1;
        return fetchMovements();
    };

    const nextPage = () => {
        if (!hasMore.value || loading.value) return;
        page.value += 1;
        return fetchMovements();
    };

    const prevPage = () => {
        if (page.value <= 1 || loading.value) return;
        page.value -= 1;
        return fetchMovements();
    };

    const reset = () => {
        lastRequest += 1;
        movements.value = [];
        hasMore.value = false;
        page.value = 1;
        Object.assign(filters, { from: '', to: '', type: ALL_MOVEMENT_TYPES });
        loading.value = false;
        error.value = '';
    };

    // En tancar sessió o canviar d'usuari no es poden quedar els moviments de l'anterior
    watch(() => authStore.user?.id, (id, previousId) => {
        if (id !== previousId) reset();
    });

    return {
        movements, hasMore, page, filters, loading, error, dateRangeError,
        fetchMovements, applyFilters, nextPage, prevPage, reset,
    };
});
