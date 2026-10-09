import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../services/supabase';

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const session = ref(null);

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

    return { user, session, initAuth, register, login, logout };
});