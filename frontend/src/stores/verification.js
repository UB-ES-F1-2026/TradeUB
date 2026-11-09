import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { apiGet, apiPost } from '../services/api';
import { useAuthStore } from './auth';
import { VERIFICATION_STATUS, reviewSecondsLeft } from '../utils/identityDocument';

// Si en acabar el compte enrere el backend encara diu "en revisió" (rellotges desajustats), es torna a preguntar
export const RECHECK_DELAY_MS = 2000;
export const MAX_RECHECKS = 5;

const STATUS_ERROR = "No s'ha pogut comprovar l'estat de la verificació.";
const KNOWN_STATUSES = Object.values(VERIFICATION_STATUS);

// Estat de la verificació simulada del DNI (US2.4). El decideix el backend a partir del moment de l'enviament:
// el frontend només mostra el compte enrere i, en acabar, torna a demanar l'estat real a GET /users/me
export const useVerificationStore = defineStore('verification', () => {
    const authStore = useAuthStore();

    const status = ref(VERIFICATION_STATUS.PENDING);
    const documentSentAt = ref(null);
    const secondsLeft = ref(0);
    const loading = ref(false);
    const checking = ref(false);
    const error = ref('');

    const isPending = computed(() => status.value === VERIFICATION_STATUS.PENDING);
    const isInReview = computed(() => status.value === VERIFICATION_STATUS.IN_REVIEW);
    const isVerified = computed(() => status.value === VERIFICATION_STATUS.VERIFIED);

    let countdownTimer = null;
    let recheckTimer = null;
    let rechecks = 0;

    const stopTimers = () => {
        clearInterval(countdownTimer);
        clearTimeout(recheckTimer);
        countdownTimer = null;
        recheckTimer = null;
    };

    // Aplica el camp verificacio de la resposta del backend; un estat desconegut es tracta com a pendent
    const apply = (verificacio) => {
        status.value = KNOWN_STATUSES.includes(verificacio?.estat) ? verificacio.estat : VERIFICATION_STATUS.PENDING;
        documentSentAt.value = verificacio?.document_enviat_at ?? null;
    };

    const fetchStatus = async () => {
        const data = await apiGet('/users/me');
        apply(data?.verificacio);
    };

    // Torna a demanar l'estat quan s'acaba el compte enrere
    const checkStatus = async () => {
        checking.value = true;
        error.value = '';
        try {
            await fetchStatus();
        } catch {
            error.value = STATUS_ERROR;
            checking.value = false;
            return;
        }
        if (isInReview.value && rechecks < MAX_RECHECKS) {
            rechecks += 1;
            recheckTimer = setTimeout(checkStatus, RECHECK_DELAY_MS);
            return;
        }
        checking.value = false;
        if (isInReview.value) error.value = STATUS_ERROR;
    };

    // El compte enrere es calcula sobre un límit local perquè el rellotge del navegador només afecti el valor inicial
    const startCountdown = () => {
        stopTimers();
        rechecks = 0;
        const deadline = Date.now() + reviewSecondsLeft(documentSentAt.value) * 1000;
        const tick = () => {
            secondsLeft.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            if (secondsLeft.value > 0) return;
            stopTimers();
            checkStatus();
        };
        countdownTimer = setInterval(tick, 1000);
        tick();
    };

    // Llegeix l'estat de GET /users/me; si el document està en revisió, reprèn el compte enrere
    const load = async () => {
        error.value = '';
        loading.value = true;
        stopTimers();
        try {
            await fetchStatus();
        } catch {
            error.value = STATUS_ERROR;
            return;
        } finally {
            loading.value = false;
        }
        if (isInReview.value) startCountdown();
    };

    // Avisa el backend que s'ha enviat el document (sense la imatge). Si falla, llança l'ApiError i l'estat no canvia
    const submitDocument = async () => {
        error.value = '';
        const data = await apiPost('/profile/identity-document');
        apply(data?.verificacio);
        if (isInReview.value) startCountdown();
    };

    const reset = () => {
        stopTimers();
        status.value = VERIFICATION_STATUS.PENDING;
        documentSentAt.value = null;
        secondsLeft.value = 0;
        loading.value = false;
        checking.value = false;
        error.value = '';
    };

    // En tancar sessió o canviar d'usuari no es pot quedar la verificació de l'anterior
    watch(() => authStore.user?.id, (id, previousId) => {
        if (id !== previousId) reset();
    });

    return {
        status, documentSentAt, secondsLeft, loading, checking, error,
        isPending, isInReview, isVerified,
        load, submitDocument, reset,
    };
});
