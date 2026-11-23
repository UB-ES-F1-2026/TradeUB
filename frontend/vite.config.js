import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Només s'activa amb --coverage (a la CI). json-summary és el que llegeix .github/scripts/frontend-summary.mjs
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/tests/**'],
      reporter: ['text', 'json-summary'],
    },
  },
})