import { expect, type Page, test } from '@playwright/test'

// #233: the material and quote calculator. Expected values are the hand-computed audit cases (docs/calculator/PLAN.md).
const URL = '/tr/malzeme-hesaplayici'
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }

const field = (page: Page, label: string, row = 1) => page.getByLabel(`${label}, ${row}. satır`, { exact: true })
const summary = (page: Page) => page.locator('aside')
// Waits for the hydrated island: text typed into the server HTML before hydration is not kept.
async function open(page: Page, url = URL) {
  await page.goto(url)
  await page.locator('[data-ready]').waitFor()
}
async function fillRow(page: Page, row: number, [t, w, l, q, p]: string[]) {
  await field(page, 'Kalınlık', row).fill(t!)
  await field(page, 'En', row).fill(w!)
  await field(page, 'Boy', row).fill(l!)
  await field(page, 'Adet', row).fill(q!)
  await field(page, 'Fiyat', row).fill(p!)
}

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`calculator ${device}`, () => {
    test.use({ viewport })

    test('server-renders the form, then computes B ("2,5" cm, "20.000" ₺/m³) while typing', async ({ page, request }) => {
      const html = await (await request.get(URL)).text()
      expect(html).toMatch(/inputmode="decimal"/i) // the form's first row is in the HTML: no layout shift on load
      await open(page)
      await fillRow(page, 1, ['2,5', '10', '400', '10', '20.000'])
      await expect(summary(page)).toContainText('0,100 m³')
      await expect(summary(page)).toContainText('₺2.000,00')
      await expect(summary(page)).toContainText('₺400,00')
      await expect(summary(page)).toContainText('₺2.400,00')
    })

    test('E: delete a row and add a new one, the totals follow (0,4 m³ / ₺9.600,00)', async ({ page }) => {
      await open(page)
      const a = ['5', '10', '400', '10', '20000']
      await fillRow(page, 1, a)
      await page.getByRole('button', { name: 'Satır ekle' }).click()
      await fillRow(page, 2, a)
      await page.getByRole('button', { name: 'Satırı sil, 1. satır' }).click()
      await page.getByRole('button', { name: 'Satır ekle' }).click()
      await fillRow(page, 2, a)
      await expect(summary(page)).toContainText('0,400 m³')
      await expect(summary(page)).toContainText('₺9.600,00')
    })

    test('G: a negative thickness is an error tied to its field, and export is held back', async ({ page }) => {
      await open(page)
      await fillRow(page, 1, ['-5', '10', '400', '10', '20000'])
      await field(page, 'Kalınlık').blur()
      await expect(field(page, 'Kalınlık')).toHaveAttribute('aria-invalid', 'true')
      await expect(field(page, 'Kalınlık')).toHaveAccessibleDescription("0'dan büyük olmalı.")
      await page.getByRole('button', { name: 'Görsel olarak paylaş' }).click()
      await expect(page.getByRole('status')).toHaveText('Önce işaretli alanları düzeltin.')
      await expect(field(page, 'Kalınlık')).toBeFocused()
    })

    test('extras, KDV rate and the share link: the reloaded link gives back the same quote', async ({ page }) => {
      await open(page)
      await fillRow(page, 1, ['5', '10', '100', '1', '20500']) // F: 102,50
      await page.getByRole('button', { name: 'Kalem ekle' }).click()
      await page.getByLabel('Açıklama, 1. kalem').fill('Nakliye')
      await page.getByLabel('Birim, 1. kalem').selectOption('goturu')
      await page.getByLabel('Birim fiyat, 1. kalem').fill('1500')
      await page.getByLabel('KDV oranı').selectOption('1')
      // 102,50 + 1 500,00 = 1 602,50; KDV %1 = 16,025 → 16,03; total 1 618,53
      await expect(summary(page)).toContainText('₺1.602,50')
      await expect(summary(page)).toContainText('₺16,03')
      await expect(summary(page)).toContainText('₺1.618,53')
      await expect(page).toHaveURL(/#c=1\./)
      const link = page.url()
      await page.goto('about:blank')
      await open(page, link)
      await expect(field(page, 'Fiyat')).toHaveValue('20500')
      await expect(summary(page)).toContainText('₺1.618,53')
      // A filled link is no separate document: the canonical is the clean page.
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/tr\/malzeme-hesaplayici$/)
    })

    test('PNG export downloads a branded image; the print sheet holds the quote', async ({ page }) => {
      await open(page)
      await fillRow(page, 1, ['5', '10', '400', '10', '20000'])
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Görsel olarak paylaş' }).click()
      const file = await download
      expect(file.suggestedFilename()).toMatch(/^kefken-hesap-\d{4}-\d{2}-\d{2}-\d{4}\.png$/)
      await page.emulateMedia({ media: 'print' })
      const sheet = page.locator('[data-calc-print]')
      await expect(sheet).toBeVisible()
      await expect(sheet).toContainText('₺4.800,00')
      await expect(sheet).toContainText('Sonuçlar tahminidir; kesin fiyat için keşif gerekir.')
      await expect(page.locator('header').first()).toBeHidden()
    })

    test('no horizontal scroll', async ({ page }) => {
      await open(page)
      await page.getByRole('button', { name: 'Kalem ekle' }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  })
}

test('every locale serves the page, Arabic right to left', async ({ page }) => {
  for (const path of ['/en/material-calculator', '/ru/kalkulyator-materialov', '/de/materialrechner', '/ar/material-calculator']) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
