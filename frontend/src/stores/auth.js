import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { supabase } from '../services/supabase';

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const session = ref(null);

    // Hi ha una sessió activa (el router ho fa servir per protegir les rutes privades)
    const isAuthenticated = computed(() => !!session.value);

    // Comprova si ja hi ha una sessió activa en carregar la pàgina
    const initAuth = async () => {
        const { data } = await supabase.auth.getSession();
        session.value = data.session;
        user.value = session.value?.user || null;

        // Escolta canvis automàtics (ex: si caduca el token)
        supabase.auth.onAuthStateChange((_event, newSession) => {
            session.value = newSession;
            user.value = newSession?.user || null;
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

    return { user, session, isAuthenticated, initAuth, register, resend, login, logout, requestPasswordReset, updatePassword };
});