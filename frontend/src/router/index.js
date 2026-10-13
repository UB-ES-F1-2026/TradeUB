import { createRouter, createWebHistory } from 'vue-router'
import RegisterView from '../views/RegisterView.vue'

const routes = [
    {
        path: '/',
        redirect: '/actius'
    },
    {
        path: '/actius',
        name: 'actius',
        component: () => import('../views/ActiusView.vue')
    },
    {
        path: '/cartera',
        name: 'cartera',
        component: () => import('../views/CarteraView.vue')
    },
    {
        path: '/historial',
        name: 'historial',
        component: () => import('../views/HistorialView.vue')
    },
    {
        path: '/bustia',
        name: 'bustia',
        component: () => import('../views/BustiaView.vue')
    },
    {
        path: '/compte-efectiu',
        name: 'compte-efectiu',
        component: () => import('../views/CompteEfectiuView.vue')
    },
    {
        path: '/perfil',
        name: 'perfil',
        component: () => import('../views/PerfilView.vue')
    },
    {
        path: '/register',
        name: 'register',
        component: RegisterView,
        meta: { hideNav: true }
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

export default router
