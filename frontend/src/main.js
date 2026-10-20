import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Inicialitzar Supabase Auth abans d'instal·lar el router: app.use(router) ja fa la primera
// navegació, i el guard necessita saber si hi ha sessió (si no, un F5 a /login o a una ruta privada falla)
const authStore = useAuthStore()
authStore.initAuth().then(() => {
    app.use(router)
    app.mount('#app')

    // Si la sessió es perd (caduca o es tanca) estant en una ruta privada, tornem al login
    watch(() => authStore.isAuthenticated, (isAuthenticated) => {
        const current = router.currentRoute.value
        if (!isAuthenticated && current.meta.requiresAuth) {
            router.replace({ name: 'login', query: { redirect: current.fullPath } })
        }
    })
})