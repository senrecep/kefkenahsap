// #41 contact page + quote form. Run the dev server with the Turnstile always-pass test keys:
// NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
import { expect, request, test, type APIRequestContext } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import type { SiteSetting } from '../../src/payload-types.js'
import { seedTestUser, testUser } from '../helpers/seedUser'

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let payload: Payload
let api: APIRequestContext
let original: SiteSetting
const stamp = Date.now()
const base = `http://localhost:${process.env.E2E_PORT ?? 3000}`

test.beforeAll(async () => {
  payload = await getPayload({ config })
  // NAP fixture through the REST API (CI has no seed; the app's hooks revalidate its cached settings).
  await seedTestUser()
  const { token } = await (await (await request.newContext()).post(`${base}/api/users/login`, { data: testUser })).json()
  api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Authorization: `JWT ${token}` } })
  original = await (await api.get('/api/globals/siteSettings?depth=0&locale=tr')).json()
  const res = await api.post('/api/globals/siteSettings?locale=tr', {
    data: {
      phones: [{ label: 'Cep', number: '0532 111 22 33', whatsapp: true }],
      address: { street: `E2E Sk. ${stamp}`, district: 'Testköy', city: 'İstanbul', mapUrl: null },
    },
  })
  expect(res.ok()).toBe(true)
})
test.afterAll(async () => {
  await api.post('/api/globals/siteSettings?locale=tr', { data: { phones: original.phones, address: original.address } }).catch(() => {})
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
    await expect(page.locator('main a[href="tel:+905321112233"]')).toBeVisible()
    await expect(page.locator("main").getByText(`E2E Sk. ${stamp}`)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Yol tarifi' })).toHaveAttribute('href', /google\.com\/maps\/search\/.*Testk%C3%B6y/)
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
    await expect(page.getByText('Aydınlatma metnini okuduğunuzu işaretleyin.')).toBeVisible()
    await expect(page.getByLabel(/Ad soyad/)).toBeFocused()
    await expect(page.getByLabel(/Ad soyad/)).toHaveAttribute('aria-invalid', 'true')
  })

  test('submits a lead with a photo, utm and locale', async ({ page }) => {
    await page.goto('/tr/iletisim?utm_source=e2e')
    await page.getByLabel(/Ad soyad/).fill(`E2E ${stamp}`)
    await page.getByLabel(/^Telefon/).fill('0532 111 22 33')
    await page.getByLabel(/Mesajınız/).fill('Bahçeye 20 m² deck')
    await page.getByLabel(/Hizmet/).selectOption('Diğer / emin değilim')
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
    expect(docs[0]!.service).toBe('Diğer / emin değilim')
    expect(docs[0]!.consentTextVersion).toMatch(/^kvkk-/)
    expect(docs[0]!.consentAt).toBeTruthy()
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

// #143: click-to-load map. Runs after the form tests (workers: 1); afterAll restores the original address.
test.describe('Contact map', () => {
  const embed = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3001.8!2d28.759!3d41.204!5e0!3m2!1str!2str'
  test.beforeAll(async () => {
    const res = await api.post('/api/globals/siteSettings?locale=tr', {
      data: {
        address: {
          street: `E2E Sk. ${stamp}`,
          city: 'İstanbul',
          mapUrl: 'https://maps.app.goo.gl/GJ64LpWJjXS3Zvqc8',
          mapEmbedUrl: embed,
          appleMapsUrl: 'https://maps.apple.com/place?place-id=IC3F39D941423A558',
        },
      },
    })
    expect(res.ok()).toBe(true)
  })

  test('rejects a non-embed iframe source in the admin field', async () => {
    const res = await api.post('/api/globals/siteSettings?locale=tr', { data: { address: { mapEmbedUrl: 'https://evil.example/maps/embed?x' } } })
    expect(res.ok()).toBe(false)
  })

  test('shows Google / Apple links, and asks Google for nothing until the visitor clicks', async ({ page }) => {
    const google: string[] = []
    page.on('request', (r) => /(^|\.)(google\.com|gstatic\.com)$/.test(new URL(r.url()).hostname) && google.push(r.url()))
    // CI may have no outbound network: answer the iframe locally instead of waiting on Google.
    await page.route('https://www.google.com/maps/embed**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>map</p>' }))
    const main = page.locator('main')
    // The settings write revalidates with 'max' (stale once, then fresh): reload until the map links are rendered.
    await expect(async () => {
      await page.goto('/tr/iletisim')
      await expect(main.getByRole('link', { name: "Google Haritalar'da aç" })).toHaveAttribute('href', 'https://maps.app.goo.gl/GJ64LpWJjXS3Zvqc8', { timeout: 1000 })
    }).toPass({ timeout: 30_000 })
    await expect(main.getByRole('link', { name: "Apple Haritalar'da aç" })).toHaveAttribute('href', /maps\.apple\.com\/place\?place-id=IC3F39D941423A558/)
    await expect(main.getByRole('link', { name: 'Yol tarifi' })).toHaveCount(0)
    await expect(main.locator('iframe')).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    expect(google).toHaveLength(0)

    const box = await main.getByRole('button', { name: /Haritayı göster/ }).boundingBox()
    await main.getByRole('button', { name: /Haritayı göster/ }).click()
    const frame = main.locator('iframe')
    await expect(frame).toHaveAttribute('src', embed)
    await expect(frame).toHaveAttribute('title', 'Konumumuz (Google Haritalar)')
    await expect(frame).toHaveAttribute('loading', 'lazy')
    await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    // Same aspect-ratio box before and after: the swap does not shift the layout.
    expect((await frame.boundingBox())!.height).toBeCloseTo(box!.height, 0)
    await expect.poll(() => google.length).toBeGreaterThan(0)
  })
})
