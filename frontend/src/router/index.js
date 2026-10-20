import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import RegisterView from '../views/RegisterView.vue'

// meta.requiresAuth: ruta privada, cal sessió
// meta.guestOnly: només sense sessió (login, registre)
// Amb la 2FA activa i la sessió encara a aal1, només es pot anar a /mfa
// meta.requiresAal2: amb la 2FA activa, cal el codi abans d'entrar (Supabase no deixa canviar la contrasenya amb aal1)
const routes = [
    {
        path: '/',
        redirect: '/actius'
    },
    {
        path: '/actius',
        name: 'actius',
        component: () => import('../views/ActiusView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/cartera',
        name: 'cartera',
        component: () => import('../views/CarteraView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/historial',
        name: 'historial',
        component: () => import('../views/HistorialView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/bustia',
        name: 'bustia',
        component: () => import('../views/BustiaView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/compte-efectiu',
        name: 'compte-efectiu',
        component: () => import('../views/CompteEfectiuView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/perfil',
        name: 'perfil',
        component: () => import('../views/PerfilView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/login',
        name: 'login',
        component: () => import('../views/LoginView.vue'),
        meta: { hideNav: true, guestOnly: true }
    },
    {
        path: '/register',
        name: 'register',
        component: RegisterView,
        meta: { hideNav: true, guestOnly: true }
    },
    {
        path: '/ui',
        name: 'styleguide',
        component: () => import('../views/StyleguideView.vue')
    },
    {   path: '/forgot-password',
        name: 'forgot-password',
        component: () => import('../views/ForgotPasswordView.vue'),
        meta: { hideNav: true, guestOnly: true }
    },
    {   path: '/reset-password',
        name: 'reset-password',
        component: () => import('../views/ResetPasswordView.vue'),
        meta: { hideNav: true, requiresAal2: true }
    },
    {
        // Segon pas de l'inici de sessió quan l'usuari té la 2FA activa
        path: '/mfa',
        name: 'mfa',
        component: () => import('../views/MfaVerifyView.vue'),
        meta: { hideNav: true }
    }

]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
})

// Protecció de rutes: s'executa abans de cada navegació
router.beforeEach((to) => {
    const authStore = useAuthStore()

    if (to.name === 'mfa') {
        if (!authStore.isAuthenticated) return { name: 'login' }
        // Sense segon pas pendent, /mfa no té sentit
        if (!authStore.needsMfa) return { path: '/actius' }
        return
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        // Guardem on volia anar per tornar-hi després del login
        return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (authStore.needsMfa && (to.meta.requiresAuth || to.meta.requiresAal2 || to.meta.guestOnly)) {
        // La ruta es recorda per tornar-hi després del codi; des de /login es manté el seu redirect
        const redirect = to.meta.guestOnly ? to.query.redirect : to.fullPath
        return { name: 'mfa', query: redirect ? { redirect } : {} }
    }

    if (to.meta.guestOnly && authStore.isAuthenticated) {
        return { path: '/actius' }
    }
})

export default router
