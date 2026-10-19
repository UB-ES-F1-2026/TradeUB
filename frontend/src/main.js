import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Inicialitzar Supabase Auth abans de muntar l'app
const authStore = useAuthStore()
authStore.initAuth().then(() => {
    app.mount('#app')

    // Si la sessió es perd (caduca o es tanca) estant en una ruta privada, tornem al login
    watch(() => authStore.isAuthenticated, (isAuthenticated) => {
        const current = router.currentRoute.value
        if (!isAuthenticated && current.meta.requiresAuth) {
            router.replace({ name: 'login', query: { redirect: current.fullPath } })
        }
    })
})