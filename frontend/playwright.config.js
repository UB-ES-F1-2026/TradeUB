import { defineConfig, devices } from '@playwright/test'

// Tests E2E contra l'entorn de DEV (Vercel + Azure + Supabase reals). Vegeu e2e/sprint2.spec.js
export default defineConfig({
  testDir: 'e2e',
  // Tots els tests fan servir el mateix usuari i el mateix saldo: un darrere l'altre
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://tradeub-dev.vercel.app',
    trace: 'retain-on-failure',
    testIdAttribute: 'data-test',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
