import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    // e2e/ és de Playwright
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Només s'activa amb --coverage (a la CI). json-summary és el que llegeix .github/scripts/frontend-summary.mjs
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/tests/**'],
      reporter: ['text', 'json-summary'],
    },
  },
})