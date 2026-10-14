import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

// Seed category 174 "Deck ve Zeminler" has > 24 approved photos; its shortDesc/body/price/FAQ are empty.
test.describe('Category page', () => {
  test('renders H1, the first 24 photos and grows with "Daha fazla göster"', async ({ page }) => {
    await page.goto('/tr/deck-ve-zeminler')
    await expect(page.locator('h1')).toHaveText('Deck ve Zeminler')
    const photos = page.locator('#gallery-h + ul > li')
    await expect(photos).toHaveCount(24)
    await expect(photos.first().locator('a')).toHaveAttribute('href', /^\/tr\/galeri\/[a-z0-9-]+$/)
    await page.getByRole('link', { name: 'Daha fazla göster' }).click()
    await expect(page).toHaveURL(/\?sayfa=2$/)
    expect(await photos.count()).toBeGreaterThan(24)
    // Empty CMS sections render nothing.
    await expect(page.getByRole('heading', { name: 'Fiyat rehberi' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Sık sorulan sorular' })).toHaveCount(0)
    await expect(page.locator('a[data-umami-event="whatsapp_click"][data-umami-event-place="category_cta"]')).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/.*Deck%20ve%20Zeminler/,
    )
  })

  test('hreflang points at the other locale’s slug of the same category', async ({ page }) => {
    await page.goto('/en/decking-and-flooring')
    await expect(page.locator('h1')).toHaveText('Decking and Flooring')
    await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveAttribute('href', /\/tr\/deck-ve-zeminler$/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/decking-and-flooring$/)
  })

  test('unknown slugs are a 404', async ({ page }) => {
    expect((await page.goto('/tr/boyle-bir-kategori-yok'))?.status()).toBe(404)
  })

  test('services page links every category', async ({ page }) => {
    await page.goto('/tr/hizmetlerimiz')
    await expect(page.locator('h1')).toHaveText('Hizmetlerimiz')
    await expect(page.locator('main a[href="/tr/deck-ve-zeminler"]')).toHaveCount(1)
    await page.goto('/en/services')
    await expect(page.locator('main a[href="/en/decking-and-flooring"]')).toHaveCount(1)
  })

  test.describe('filled CMS sections', () => {
    let payload: Payload
    const stamp = Date.now()
    const slug = `e2e-kategori-${stamp}`
    let categoryId: number
    let projectId: number
    const text = (t: string) => ({ type: 'text', text: t, version: 1, format: 0, detail: 0, mode: 'normal', style: '' })
    const block = (type: string, t: string, extra = {}) => ({ type, children: [text(t)], direction: 'ltr' as const, format: '' as const, indent: 0, version: 1, ...extra })

    test.beforeAll(async () => {
      payload = await getPayload({ config })
      const cover = (await payload.find({ collection: 'media', where: { status: { equals: 'approved' } }, limit: 1, depth: 0 })).docs[0]!
      const category = await payload.create({
        collection: 'categories',
        locale: 'tr',
        data: {
          _status: 'published',
          name: `E2E Kategori ${stamp}`,
          slug,
          shortDesc: 'Kısa giriş metni.',
          body: { root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1, children: [block('heading', 'Ne kadar sürer?', { tag: 'h2' }), block('paragraph', 'Gövde paragrafı.')] } },
          faq: [{ q: 'Bakım gerekir mi?', a: 'Yılda bir yağlama yeterli.' }],
          priceGuide: { min: 2500, max: 4000, unit: 'm2', currency: 'TRY', note: 'Ahşap türüne göre değişir.', updatedAt: '2026-09-01T00:00:00.000Z' },
        },
      })
      categoryId = category.id
      const project = await payload.create({
        collection: 'projects',
        locale: 'tr',
        data: { _status: 'published', title: `E2E Proje ${stamp}`, categories: [categoryId], cover: cover.id, city: 'İstanbul', year: 2024 },
      })
      projectId = project.id
    })
    test.afterAll(async () => {
      if (projectId) await payload.delete({ collection: 'projects', id: projectId })
      if (categoryId) await payload.delete({ collection: 'categories', id: categoryId })
    })

    test('shows intro, body, price guide with date, FAQ and related projects; no EN alternate', async ({ page }) => {
      await page.goto(`/tr/${slug}`)
      await expect(page.getByText('Kısa giriş metni.')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Ne kadar sürer?' })).toBeVisible()
      await expect(page.getByText('Gövde paragrafı.')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Fiyat rehberi' })).toBeVisible()
      await expect(page.getByText(/2\.500/)).toBeVisible()
      await expect(page.locator('time[datetime="2026-09-01T00:00:00.000Z"]')).toBeVisible()
      await page.getByText('Bakım gerekir mi?').click()
      await expect(page.getByText('Yılda bir yağlama yeterli.')).toBeVisible()
      await expect(page.getByRole('link', { name: new RegExp(`E2E Proje ${stamp}`) })).toHaveAttribute('href', /^\/tr\/projeler\/e2e-proje-/)
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
    })
  })
})
