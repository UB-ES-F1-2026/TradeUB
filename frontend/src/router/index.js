import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import RegisterView from '../views/RegisterView.vue'

// meta.requiresAuth: ruta privada, cal sessió
// meta.guestOnly: només sense sessió (login, registre)
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
        meta: { guestOnly: true }
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
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
})

// Protecció de rutes: s'executa abans de cada navegació
router.beforeEach((to) => {
    const authStore = useAuthStore()

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        // Guardem on volia anar per tornar-hi després del login
        return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (to.meta.guestOnly && authStore.isAuthenticated) {
        return { path: '/actius' }
    }
})

export default router
