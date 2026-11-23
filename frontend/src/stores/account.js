import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { apiGet, apiPost, apiPut } from '../services/api';
import { useAuthStore } from './auth';

// Saldo simulat del compte virtual. El backend el llegeix de la taula accounts (només lectura per a l'usuari)
export const useAccountStore = defineStore('account', () => {
    const authStore = useAuthStore();

    const balance = ref(null);
    const currency = ref('EUR');
    const updatedAt = ref(null);
    const loading = ref(false);
    const error = ref('');
    // IBAN vinculat per a les retirades (US3.3), sempre emmascarat: el backend no retorna mai el complet
    const ibanMasked = ref(null);
    // Posicions de l'usuari (US6.2): unitats enteres per id d'actiu. Un actiu sense posició no hi és
    const positions = ref({});

    const hasBalance = computed(() => balance.value !== null);

    const unitsHeld = (assetId) => positions.value[assetId] ?? 0;

    // Les unitats que retornen la compra i la venda són les de la posició després de l'operació; 0 vol dir que
    // s'ha venut tot i el backend ha esborrat la posició
    const setPosition = (assetId, units) => {
        const rest = { ...positions.value };
        delete rest[assetId];
        positions.value = units > 0 ? { ...rest, [assetId]: units } : rest;
    };

    const reset = () => {
        balance.value = null;
        currency.value = 'EUR';
        updatedAt.value = null;
        loading.value = false;
        error.value = '';
        ibanMasked.value = null;
        positions.value = {};
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

    // Ingressa diners ficticis (US3.2). L'import arriba com a text ("50.25") perquè el backend el llegeixi exacte.
    // El saldo nou és el que retorna el backend; si falla, llança l'ApiError i el saldo no canvia
    const deposit = async (amount) => {
        const data = await apiPost('/account/deposits', { amount });
        balance.value = Number(data.balance);
        error.value = '';
    };

    // Llegeix l'IBAN emmascarat del perfil (GET /users/me). Si falla, llança l'error i no es toca el que hi havia
    const loadIban = async () => {
        const data = await apiGet('/users/me');
        ibanMasked.value = data?.perfil?.iban_emmascarat ?? null;
    };

    // Vincula l'IBAN o substitueix el que hi havia (PUT /profile/iban). Si el backend el rebutja, llança l'ApiError
    const linkIban = async (iban) => {
        const data = await apiPut('/profile/iban', { iban });
        ibanMasked.value = data.iban_emmascarat;
    };

    // Retira diners ficticis cap a l'IBAN vinculat (US3.3). El PIN va a la capçalera X-PIN (require_pin al backend).
    // El saldo nou és el que retorna el backend; si falla, llança l'ApiError i el saldo no canvia
    const withdraw = async (amount, pin) => {
        const data = await apiPost('/account/withdrawals', { amount }, { 'X-PIN': pin });
        balance.value = Number(data.balance);
        error.value = '';
    };

    // Compra unitats d'un actiu (US6.1). El PIN va a la capçalera X-PIN (require_pin al backend). El backend cobra
    // el cost amb el preu del catàleg i retorna el saldo nou i el que s'ha cobrat (cost, commission i total).
    // Si falla, llança l'ApiError i el saldo no canvia
    const buy = async (assetId, units, pin) => {
        const data = await apiPost('/orders/buy', { asset_id: assetId, units }, { 'X-PIN': pin });
        balance.value = Number(data.balance);
        setPosition(assetId, Number(data.units));
        error.value = '';
        return data;
    };

    // Llegeix les posicions (GET /account/positions). Si falla, llança l'error i no es toca el que hi havia
    const fetchPositions = async () => {
        const data = await apiGet('/account/positions');
        positions.value = Object.fromEntries((data ?? []).map((p) => [p.asset_id, Number(p.units)]));
    };

    // Ven unitats d'una posició (US6.2). El PIN va a la capçalera X-PIN (require_pin al backend). El backend ingressa
    // l'import net amb el preu del catàleg i retorna el saldo nou, les unitats que queden i l'import (amount,
    // commission i net). Si falla, llança l'ApiError i ni el saldo ni la posició canvien
    const sell = async (assetId, units, pin) => {
        const data = await apiPost('/orders/sell', { asset_id: assetId, units }, { 'X-PIN': pin });
        balance.value = Number(data.balance);
        setPosition(assetId, Number(data.units));
        error.value = '';
        return data;
    };

    // En tancar sessió o canviar d'usuari no es pot quedar el saldo de l'anterior
    watch(() => authStore.user?.id, (id, previousId) => {
        if (id !== previousId) reset();
    });

    return {
        balance, currency, updatedAt, loading, error, ibanMasked, positions, hasBalance,
        fetchBalance, deposit, loadIban, linkIban, withdraw, buy, fetchPositions, unitsHeld, sell, reset,
    };
});
