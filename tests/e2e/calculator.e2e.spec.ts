import { expect, type Page, test } from '@playwright/test'

// #233: the material and quote calculator. Expected values are the hand-computed audit cases (docs/calculator/PLAN.md).
const URL = '/tr/malzeme-hesaplayici'
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }

const field = (page: Page, label: string, row = 1) => page.getByLabel(`${label}, ${row}. satır`, { exact: true })
const EN = { Kalınlık: 'Thickness', En: 'Width', Boy: 'Length', Adet: 'Pieces', Fiyat: 'Price' } as Record<string, string>
const summary = (page: Page) => page.locator('aside')
// Waits for the hydrated island: text typed into the server HTML before hydration is not kept.
async function open(page: Page, url = URL) {
  await page.goto(url)
  await page.locator('[data-ready]').waitFor()
}
async function fillRow(page: Page, row: number, values: string[], en?: 'row') {
  const labels = ['Kalınlık', 'En', 'Boy', 'Adet', 'Fiyat']
  for (const [i, v] of values.entries()) {
    const l = labels[i]!
    await (en ? page.getByLabel(`${EN[l]}, row ${row}`, { exact: true }) : field(page, l, row)).fill(v)
  }
}

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`calculator ${device}`, () => {
    test.use({ viewport })

    test('server-renders the form, then computes B ("2,5" cm, "20.000,00" ₺/m³) while typing', async ({ page, request }) => {
      const html = await (await request.get(URL)).text()
      expect(html).toMatch(/inputmode="decimal"/i) // the form's first row is in the HTML: no layout shift on load
      await open(page)
      await fillRow(page, 1, ['2,5', '10', '400', '10', '20.000,00'])
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
      await expect(page).toHaveURL(/#c=2\./)
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

test.describe('#236 review', () => {
  test('a Turkish link reads the same on the English page (prices are language-independent)', async ({ page }) => {
    await open(page)
    await fillRow(page, 1, ['5', '10', '400', '10', '20.000,00']) // A: 4 800,00 with KDV
    await expect(page).toHaveURL(/#c=2\./)
    const hash = new globalThis.URL(page.url()).hash
    await open(page, `/en/material-calculator${hash}`)
    await expect(summary(page)).toContainText('₺4,800.00')
  })

  test('an old v1 link is read with the Turkish rules it was made under', async ({ page }) => {
    // v1 packing of A with the price typed "20.000" (= 20 000 ₺ on the Turkish page then).
    const v1 = [['cm', 'cm', 'cm'], [['5', '10', '400', '10', '20.000']], '', [], [1, 20], ['', '', '']]
    const b64 = Buffer.from(JSON.stringify(v1)).toString('base64url')
    await open(page, `/en/material-calculator#c=1.${b64}`)
    await expect(summary(page)).toContainText('₺4,800.00')
  })

  test('owner decision: tr "20.000" is twenty thousand, "2.5" a decimal; the value as read shows under the field', async ({ page }) => {
    await open(page)
    await fillRow(page, 1, ['2.5', '10', '400', '10', '20.000']) // 2,5 × 10 × 400 cm × 10 = 0,1 m³ × 20 000 = 2 000,00 + KDV = 2 400,00
    await expect(summary(page)).toContainText('0,100 m³')
    await expect(summary(page)).toContainText('₺2.400,00')
    await expect(field(page, 'Fiyat')).toHaveAccessibleDescription('= ₺20.000,00')
    await expect(field(page, 'Kalınlık')).toHaveAccessibleDescription('= 2,5')
    await fillRow(page, 1, ['5', '10', '400', '10', '20.000']) // A: 4 800,00
    await expect(summary(page)).toContainText('₺4.800,00')
  })

  test('en "20,000" is twenty thousand; en order typed on the tr page is an error with a clear message', async ({ page }) => {
    await open(page, '/en/material-calculator')
    await fillRow(page, 1, ['5', '10', '400', '10', '20,000'], 'row')
    await expect(summary(page)).toContainText('₺4,800.00')
    await open(page)
    await fillRow(page, 1, ['5', '10', '400', '10', '20,000.50'])
    await field(page, 'Fiyat').blur()
    await expect(field(page, 'Fiyat')).toHaveAccessibleDescription('Belirsiz sayı: binlik için 1000, ondalık için 1,5 gibi yazın.')
  })

  test('a link opened in a background tab is not overwritten before it is read', async ({ page }) => {
    // requestAnimationFrame never runs in a hidden tab: simulate that and check the quote still loads and stays in the URL.
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0
    })
    const v2 = Buffer.from(JSON.stringify([['cm', 'cm', 'cm'], [['5', '10', '400', '10', '20000']], '', [], [1, 20], ['', '', '']])).toString('base64url')
    await page.goto(`${URL}#c=2.${v2}`)
    await page.waitForTimeout(800) // past the 300 ms address writer
    expect(new globalThis.URL(page.url()).hash).toBe(`#c=2.${v2}`)
    await expect(summary(page)).toContainText('₺4.800,00')
  })

  test('the language menu carries the quote to the other language', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await fillRow(page, 1, ['5', '10', '400', '10', '20000'])
    await expect(page).toHaveURL(/#c=2\./)
    // The alternates carry the configured site URL; point them at this server so the switch stays here.
    await page.evaluate(() => document.querySelectorAll<HTMLLinkElement>('link[rel=alternate]').forEach((l) => (l.href = location.origin + new globalThis.URL(l.href).pathname)))
    await page.locator('header details.group\\/lang summary').click()
    await page.locator('header a[hreflang="en"]').first().click()
    await page.waitForURL(/\/en\/material-calculator#c=2\./)
    await page.locator('[data-ready]').waitFor()
    await expect(summary(page)).toContainText('₺4,800.00')
  })
})

test('every locale serves the page, Arabic right to left', async ({ page }) => {
  for (const path of ['/en/material-calculator', '/ru/kalkulyator-materialov', '/de/materialrechner', '/ar/material-calculator']) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
