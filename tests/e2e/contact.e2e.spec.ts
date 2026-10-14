// #41 contact page + quote form. Run the dev server with the Turnstile always-pass test keys:
// NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let payload: Payload
const stamp = Date.now()

test.beforeAll(async () => {
  payload = await getPayload({ config })
})
test.afterAll(async () => {
  const leads = await payload.find({ collection: 'leads', where: { name: { like: `E2E ${stamp}` } }, depth: 0, limit: 10 })
  for (const l of leads.docs) {
    for (const p of (l.photos ?? []) as number[]) await payload.delete({ collection: 'lead-photos', id: p }).catch(() => {})
    await payload.delete({ collection: 'leads', id: l.id })
  }
})

test.describe('Contact page', () => {
  test('shows NAP, directions link (no map iframe) and loads Turnstile only here', async ({ page }) => {
    const turnstile: string[] = []
    page.on('request', (r) => r.url().includes('challenges.cloudflare.com') && turnstile.push(r.url()))
    await page.goto('/tr')
    expect(turnstile).toHaveLength(0)
    await page.goto('/tr/iletisim')
    await expect(page.locator('h1')).toHaveText('İletişim ve teklif')
    await expect(page.locator('main a[href^="tel:"]').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Yol tarifi' })).toHaveAttribute('href', /google\.com\/maps|goo\.gl/)
    await expect(page.locator('main iframe[src*="maps"]')).toHaveCount(0)
    expect(turnstile).toHaveLength(0)
    await page.getByLabel(/Ad soyad/).focus()
    await expect.poll(() => turnstile.length, { timeout: 20_000 }).toBeGreaterThan(0)
  })

  test('inline Turkish errors name the problem and move focus to the first one', async ({ page }) => {
    await page.goto('/tr/iletisim')
    await page.getByRole('button', { name: 'Teklif iste' }).click()
    await expect(page.getByText('Ad soyad boş.')).toBeVisible()
    await expect(page.getByText('Telefon numarası eksik ya da hatalı.')).toBeVisible()
    await expect(page.getByText('KVKK onayı verilmedi.')).toBeVisible()
    await expect(page.getByLabel(/Ad soyad/)).toBeFocused()
    await expect(page.getByLabel(/Ad soyad/)).toHaveAttribute('aria-invalid', 'true')
  })

  test('submits a lead with a photo, utm and locale', async ({ page }) => {
    await page.goto('/tr/iletisim?utm_source=e2e')
    await page.getByLabel(/Ad soyad/).fill(`E2E ${stamp}`)
    await page.getByLabel(/^Telefon/).fill('0532 111 22 33')
    await page.getByLabel(/Mesajınız/).fill('Bahçeye 20 m² deck')
    await page.getByLabel(/Fotoğraflar/).setInputFiles({ name: 'bahce.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('1 fotoğraf seçildi')).toBeVisible()
    await page.locator('#consent').check()
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 20_000 })
    await page.getByRole('button', { name: 'Teklif iste' }).click()
    await expect(page.getByRole('heading', { name: 'Talebiniz bize ulaştı' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: "WhatsApp'tan da yazabilirsiniz" })).toBeVisible()

    const { docs } = await payload.find({ collection: 'leads', where: { name: { equals: `E2E ${stamp}` } }, depth: 0 })
    expect(docs).toHaveLength(1)
    expect(docs[0]!.phone).toBe('905321112233')
    expect(docs[0]!.locale).toBe('tr')
    expect(docs[0]!.utm).toEqual({ utm_source: 'e2e' })
    expect(docs[0]!.photos).toHaveLength(1)
  })

  test('a filled honeypot looks successful but stores nothing', async ({ page }) => {
    await page.goto('/tr/iletisim')
    await page.getByLabel(/Ad soyad/).fill(`E2E ${stamp} bot`)
    await page.getByLabel(/^Telefon/).fill('0532 111 22 33')
    await page.locator('#consent').check()
    await page.locator('#website').fill('http://spam.example', { force: true })
    await page.getByRole('button', { name: 'Teklif iste' }).click()
    await expect(page.getByRole('heading', { name: 'Talebiniz bize ulaştı' })).toBeVisible()
    const { totalDocs } = await payload.count({ collection: 'leads', where: { name: { equals: `E2E ${stamp} bot` } } })
    expect(totalDocs).toBe(0)
  })
})
