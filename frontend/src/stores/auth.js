import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { supabase } from '../services/supabase';

// Llegeix una claim del JWT d'accés (només per mostrar estat, la validació la fa Supabase)
function jwtClaim(token, claim) {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload))[claim] ?? null;
    } catch {
        return null;
    }
}

// Nivell d'autenticació (AAL) de la sessió, amb el mateix criteri que
// supabase.auth.mfa.getAuthenticatorAssuranceLevel(), però síncron i sense xarxa
// perquè el guard del router i onAuthStateChange el puguin fer servir directament
function assuranceLevel(session) {
    if (!session) return { currentLevel: null, nextLevel: null };
    const currentLevel = jwtClaim(session.access_token, 'aal') ?? 'aal1';
    const hasVerifiedFactor = (session.user?.factors ?? []).some((f) => f.status === 'verified');
    return { currentLevel, nextLevel: hasVerifiedFactor ? 'aal2' : currentLevel };
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const session = ref(null);

    // Hi ha una sessió activa (el router ho fa servir per protegir les rutes privades)
    const isAuthenticated = computed(() => !!session.value);

    // aal1: només contrasenya; aal2: contrasenya + codi TOTP
    const aal = computed(() => assuranceLevel(session.value));

    // L'usuari té la 2FA activa però encara no ha introduït el codi en aquesta sessió
    const needsMfa = computed(() => aal.value.currentLevel === 'aal1' && aal.value.nextLevel === 'aal2');

    const setSession = (newSession) => {
        session.value = newSession;
        user.value = newSession?.user || null;
    };

    // Comprova si ja hi ha una sessió activa en carregar la pàgina
    const initAuth = async () => {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);

        // Escolta canvis automàtics (ex: si caduca el token o es verifica el codi 2FA)
        supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
        });
    };

    const register = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    };

    const resend = async (email) => {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw error;
    };

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Sense esperar onAuthStateChange: el login ha de saber ja si cal el segon pas
        setSession(data.session);
        return data;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        user.value = null;
        session.value = null;
    };
        const requestPasswordReset = async (email) => {
        // Ignorem l'error a propòsit: l'avís a l'usuari és sempre genèric
        await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
    };

    const updatePassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        // Tanquem la sessió de recuperació i netegem l'estat local
        await logout();
    };

    // --- Verificació en dos passos (TOTP). Supabase desa el factor i el secret, aquí no es guarda res ---

    // Factor TOTP verificat de l'usuari, o null si no té la 2FA activa
    const getTotpFactor = async () => {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        return data.totp[0] ?? null;
    };

    // Comença l'activació: retorna el QR (SVG en data URI) i el secret per introduir-lo a mà
    const enrollTotp = async () => {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;

        // Activacions a mitges (QR generat però mai confirmat): s'esborren abans de crear-ne una de nova
        const pending = factors.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified');
        for (const factor of pending) {
            const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
            if (error) throw error;
        }

        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'TradeUB' });
        if (error) throw error;
        return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
    };

    // Comprova un codi: confirma l'activació o completa el segon pas de l'inici de sessió (la sessió passa a aal2)
    const verifyTotp = async (factorId, code) => {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
    };

    // Segon pas de l'inici de sessió amb el factor verificat de l'usuari
    const verifyMfaLogin = async (code) => {
        const factor = await getTotpFactor();
        if (!factor) throw new Error('No hi ha cap factor TOTP verificat');
        await verifyTotp(factor.id, code);
    };

    // Desactiva la 2FA. Supabase exigeix una sessió aal2, per això primer es demana el codi
    const unenrollTotp = async (factorId, code) => {
        await verifyTotp(factorId, code);
        const { error } = await supabase.auth.mfa.unenroll({ factorId });
        if (error) throw error;
        // Refresquem la sessió perquè user.factors deixi d'incloure el factor esborrat
        const { data } = await supabase.auth.refreshSession();
        if (data?.session) setSession(data.session);
    };

    return {
        user, session, isAuthenticated, aal, needsMfa,
        initAuth, register, resend, login, logout, requestPasswordReset, updatePassword,
        getTotpFactor, enrollTotp, verifyTotp, verifyMfaLogin, unenrollTotp,
    };
});
