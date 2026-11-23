import { expect, test } from '@playwright/test'

// QA 6 (#158): recorreguts del Sprint 2 contra DEV amb un usuari de prova verificat, amb PIN i IBAN i sense 2FA.
// Comproven el que els tests amb mocks no veuen: migracions, VITE_API_URL, CORS i permisos.
// L'ingrés i la retirada són del mateix import perquè el saldo de l'usuari de prova no creixi
const { E2E_EMAIL, E2E_PASSWORD, E2E_PIN } = process.env
const AMOUNT = '1'
const WRONG_PIN = E2E_PIN === '0000' ? '1111' : '0000'

test.skip(!E2E_EMAIL || !E2E_PASSWORD || !E2E_PIN, 'Falten els secrets E2E_EMAIL, E2E_PASSWORD i E2E_PIN')

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correu electrònic').fill(E2E_EMAIL)
  await page.getByLabel('Contrasenya').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Inicia sessió' }).click()
  await expect(page).not.toHaveURL(/\/(login|mfa|onboarding)/)
})

// "1.234,56 €" → 1234.56
const euros = (text) => Number(text.replace(/[^\d,-]/g, '').replace(',', '.'))

async function balance(page) {
  const total = page.getByTestId('total')
  await expect(total).toHaveText(/\d/)
  return euros(await total.innerText())
}

async function expectBalance(page, expected) {
  await expect.poll(() => balance(page)).toBeCloseTo(expected, 2)
}

async function latestMovement(page) {
  await page.getByRole('link', { name: 'Historial' }).click()
  const row = page.getByTestId('movement-row').first()
  await expect(row).toBeVisible()
  return row
}

test('ingrés → saldo → historial (US3.2, US3.5)', async ({ page }) => {
  await page.goto('/compte-efectiu')
  const before = await balance(page)

  await page.getByTestId('deposit-amount').fill(AMOUNT)
  await page.getByRole('button', { name: 'Ingressar' }).click()

  await expectBalance(page, before + Number(AMOUNT))
  await expect(await latestMovement(page)).toContainText('Ingrés de diners')
})

test('retirada amb PIN incorrecte i després correcte → historial (US3.3, US1.5, US3.5)', async ({ page }) => {
  await page.goto('/compte-efectiu')
  const before = await balance(page)
  await expect(page.getByTestId('withdrawal-iban-masked')).toBeVisible()

  await page.getByTestId('withdrawal-amount').fill(AMOUNT)
  await page.getByRole('button', { name: 'Continua' }).click()
  const pin = page.getByTestId('pin-input')

  await pin.fill(WRONG_PIN)
  await page.getByRole('button', { name: 'Confirma' }).click()
  await expect(page.getByText('El PIN introduït és incorrecte.')).toBeVisible()
  await expectBalance(page, before)

  await pin.fill(E2E_PIN)
  await page.getByRole('button', { name: 'Confirma' }).click()
  await expect(page.getByTestId('withdrawal-success')).toBeVisible()
  await expectBalance(page, before - Number(AMOUNT))

  const row = await latestMovement(page)
  await expect(row).toContainText('Retirada a ES••')
  await expect(row.getByTestId('movement-amount')).toHaveClass(/movements__amount--out/)
})

test('canviar el PIN amb el PIN actual equivocat (US1.5)', async ({ page }) => {
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Canviar el PIN' }).click()
  await page.getByLabel('PIN actual').fill(WRONG_PIN)
  // El PIN nou és el mateix: si per error es desés, l'usuari de prova no canviaria
  await page.getByLabel('PIN nou', { exact: true }).fill(E2E_PIN)
  await page.getByLabel('Repeteix el PIN nou').fill(E2E_PIN)
  await page.getByRole('button', { name: 'Desa el PIN' }).click()

  await expect(page.getByText('El PIN actual és incorrecte.')).toBeVisible()
})

test('cerca d\'actius amb i sense resultats (US5.1)', async ({ page }) => {
  await page.goto('/actius')
  const search = page.getByTestId('asset-search')

  await search.fill('app')
  await expect(page.getByTestId('asset-result').filter({ hasText: 'Apple' })).toBeVisible()

  await search.fill('zzz')
  await expect(page.getByTestId('no-results')).toContainText("No s'han trobat actius")
})
