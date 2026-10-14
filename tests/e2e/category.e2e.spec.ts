import { type APIRequestContext, expect, test } from '@playwright/test'

import { adminApi, createDoc, deleteDocs, ensureWhatsApp, uploadPhoto } from '../helpers/content'

const PAGE_SIZE = 24

// Self-contained (CI starts from an empty DB): two categories, photos and a project, created through REST and deleted afterwards.
test.describe('Category page', () => {
  let api: APIRequestContext
  let restoreWhatsApp = async () => {}
  const stamp = Date.now()
  const ids = { projects: [] as number[], media: [] as number[], categories: [] as number[] }
  const full = { tr: `e2e-kategori-${stamp}`, en: `e2e-category-${stamp}`, name: `E2E Kategori ${stamp}` }
  const bare = { tr: `e2e-bos-kategori-${stamp}`, name: `E2E Boş Kategori ${stamp}` }
  const text = (t: string) => ({ type: 'text', text: t, version: 1, format: 0, detail: 0, mode: 'normal', style: '' })
  const block = (type: string, t: string, extra = {}) => ({ type, children: [text(t)], direction: 'ltr', format: '', indent: 0, version: 1, ...extra })

  test.beforeAll(async () => {
    test.setTimeout(180_000)
    api = await adminApi()
    restoreWhatsApp = await ensureWhatsApp(api)
    const category = await createDoc(api, 'categories', {
      _status: 'published',
      name: full.name,
      slug: full.tr,
      shortDesc: 'Kısa giriş metni.',
      body: { root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1, children: [block('heading', 'Ne kadar sürer?', { tag: 'h2' }), block('paragraph', 'Gövde paragrafı.')] } },
      faq: [{ q: 'Bakım gerekir mi?', a: 'Yılda bir yağlama yeterli.' }],
      priceGuide: { min: 2500, max: 4000, unit: 'm2', currency: 'TRY', note: 'Ahşap türüne göre değişir.', updatedAt: '2026-09-01T00:00:00.000Z' },
    })
    ids.categories.push(category.id)
    const en = await api.patch(`/api/categories/${category.id}?locale=en`, { data: { name: `E2E Category ${stamp}`, slug: full.en } })
    expect(en.ok(), await en.text()).toBe(true)
    // More than one page, so "Daha fazla göster" appears.
    for (let i = 0; i < PAGE_SIZE + 2; i++) ids.media.push((await uploadPhoto(api, { seoFilename: `e2e-kategori-${stamp}-${i}`, category: category.id }, i)).id)
    ids.categories.push((await createDoc(api, 'categories', { _status: 'published', name: bare.name, slug: bare.tr })).id)
    const project = await createDoc(api, 'projects', { _status: 'published', title: `E2E Proje ${stamp}`, categories: [category.id], gallery: [ids.media[0]], city: 'İstanbul', year: 2024 })
    ids.projects.push(project.id)
  })

  test.afterAll(async () => {
    for (const [collection, list] of Object.entries(ids)) await deleteDocs(api, collection, list)
    await restoreWhatsApp()
  })

  test('renders H1, a header photo, at most one page of photos and grows with "Daha fazla göster"', async ({ page }) => {
    await page.goto(`/tr/${full.tr}`)
    await expect(page.locator('h1')).toHaveText(full.name)
    await expect(page.locator('main img').first()).toBeVisible()
    const photos = page.locator('#gallery-h + ul > li')
    const first = await photos.count()
    expect(first).toBeGreaterThanOrEqual(1)
    expect(first).toBeLessThanOrEqual(PAGE_SIZE)
    await expect(photos.first().locator('a')).toHaveAttribute('href', /^\/tr\/galeri\/[a-z0-9-]+$/)
    await page.getByRole('link', { name: 'Daha fazla göster' }).click()
    await expect(page).toHaveURL(/\?sayfa=2$/)
    await expect.poll(() => photos.count()).toBeGreaterThan(first)
    await expect(page.locator('a[data-umami-event="whatsapp_click"][data-umami-event-place="category_cta"]')).toHaveAttribute('href', /^https:\/\/wa\.me\//)
  })

  test('shows intro, body, price guide with date, FAQ and related projects', async ({ page }) => {
    await page.goto(`/tr/${full.tr}`)
    await expect(page.getByText('Kısa giriş metni.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ne kadar sürer?' })).toBeVisible()
    await expect(page.getByText('Gövde paragrafı.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fiyat rehberi' })).toBeVisible()
    await expect(page.getByText(/2\.500/)).toBeVisible()
    await expect(page.locator('time[datetime="2026-09-01T00:00:00.000Z"]')).toBeVisible()
    await page.getByText('Bakım gerekir mi?').click()
    await expect(page.getByText('Yılda bir yağlama yeterli.')).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(`E2E Proje ${stamp}`) })).toHaveAttribute('href', /^\/tr\/projeler\/e2e-proje-/)
  })

  test('empty CMS sections render nothing', async ({ page }) => {
    await page.goto(`/tr/${bare.tr}`)
    await expect(page.locator('h1')).toHaveText(bare.name)
    for (const name of ['Fiyat rehberi', 'Sık sorulan sorular', 'Bu alandaki projeler']) await expect(page.getByRole('heading', { name })).toHaveCount(0)
    await expect(page.locator('#gallery-h')).toHaveCount(0)
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
  })

  test('hreflang points at the other locale’s slug of the same category', async ({ page }) => {
    await page.goto(`/en/${full.en}`)
    await expect(page.locator('h1')).toHaveText(`E2E Category ${stamp}`)
    await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveAttribute('href', new RegExp(`/tr/${full.tr}$`))
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/en/${full.en}$`))
  })

  test('unknown slugs are a 404', async ({ page }) => {
    expect((await page.goto('/tr/boyle-bir-kategori-yok'))?.status()).toBe(404)
  })

  test('services page links the categories', async ({ page }) => {
    await page.goto('/tr/hizmetlerimiz')
    await expect(page.locator('h1')).toHaveText('Hizmetlerimiz')
    await expect(page.locator(`main a[href="/tr/${full.tr}"]`)).toHaveCount(1)
    await page.goto('/en/services')
    await expect(page.locator(`main a[href="/en/${full.en}"]`)).toHaveCount(1)
  })
})
