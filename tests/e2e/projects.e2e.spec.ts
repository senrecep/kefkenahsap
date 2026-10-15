import { type APIRequestContext, expect, test } from '@playwright/test'

import { adminApi, createDoc, deleteDocs, ensureWhatsApp, uploadPhoto } from '../helpers/content'

// Self-contained (CI starts from an empty DB): its own category, photos, tag, reference and two projects,
// all created through the REST API and deleted afterwards.
test.describe('Projects, project page and references', () => {
  let api: APIRequestContext
  let restoreWhatsApp = async () => {}
  const stamp = Date.now()
  const ids = { projects: [] as number[], media: [] as number[], categories: [] as number[], references: [] as number[], tags: [] as number[] }
  const categorySlug = `e2e-proje-kategori-${stamp}`
  let galleryFiles: string[] = []
  let full: { slug: string; title: string }
  let bare: { slug: string; title: string }

  test.beforeAll(async () => {
    api = await adminApi()
    restoreWhatsApp = await ensureWhatsApp(api)
    const category = await createDoc(api, 'categories', { _status: 'published', name: `E2E Proje Kategori ${stamp}`, slug: categorySlug })
    ids.categories.push(category.id)
    const photos = []
    for (let i = 0; i < 4; i++) photos.push(await uploadPhoto(api, { seoFilename: `e2e-proje-${stamp}-${i}`, category: category.id }, i))
    ids.media.push(...photos.map((p) => p.id))
    // Saved order deliberately differs from the upload order.
    const ordered = [...photos].reverse()
    galleryFiles = ordered.map((p) => p.seoFilename)
    const wood = await createDoc(api, 'tags', { name: `E2E Iroko ${stamp}`, axis: 'wood' })
    ids.tags.push(wood.id)
    const ref = await createDoc(api, 'references', { name: `E2E Referans ${stamp}`, location: 'Riva / İstanbul' })
    ids.references.push(ref.id)
    type P = { id: number; slug: string; title: string }
    const a = await createDoc<P>(api, 'projects', {
      _status: 'published',
      title: `E2E Havuz Deck ${stamp}`,
      categories: [category.id],
      gallery: ordered.map((p) => p.id),
      city: 'İstanbul',
      district: 'Beykoz',
      year: 2019,
      areaValue: 120,
      areaUnit: 'm2',
      woodSpecies: [wood.id],
      reference: ref.id,
      testimonial: { quote: 'Gizli yorum', author: 'A. Müşteri', consentGiven: false },
    })
    const b = await createDoc<P>(api, 'projects', {
      _status: 'published',
      title: `E2E Boş Künye ${stamp}`,
      categories: [category.id],
      testimonial: { quote: 'Çok memnun kaldık.', author: 'B. Müşteri', consentGiven: true },
    })
    ids.projects.push(a.id, b.id)
    full = a
    bare = b
  })

  test.afterAll(async () => {
    for (const [collection, list] of Object.entries(ids)) await deleteDocs(api, collection, list)
    await restoreWhatsApp()
  })

  test('project page shows only filled facts, ordered gallery, consented testimonial only, similar projects and CTA', async ({
    page,
  }) => {
    await page.goto(`/tr/projeler/${full.slug}`)
    await expect(page.locator('h1')).toHaveText(full.title)
    const facts = page.getByRole('region', { name: 'Proje künyesi' })
    await expect(facts.locator('dt')).toHaveText(['Yer', 'Yıl', 'Alan', 'Ahşap türü'])
    // Categories are linked chips under the title, not a künye row.
    await expect(page.locator('header').getByRole('list', { name: 'Kategori' }).getByRole('link')).toHaveAttribute('href', `/tr/${categorySlug}`)
    await expect(facts).toContainText('Beykoz, İstanbul')
    await expect(facts).toContainText('120 m²')
    // No cover: the first gallery photo is the hero, the rest follow in saved order.
    const hrefs = await page.locator('#photos-h + ul a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    expect(hrefs).toEqual(galleryFiles.slice(1).map((f) => `/tr/galeri/${f}`))
    await expect(page.getByText('Gizli yorum')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Benzer projeler' })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(bare.title) })).toBeVisible()
    await expect(page.locator('a[data-umami-event-place="project_cta"]')).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/.*E2E%20Havuz%20Deck/,
    )

    await page.goto(`/tr/projeler/${bare.slug}`)
    // Only the category is filled: no künye box at all, just the chip under the title.
    await expect(page.getByRole('region', { name: 'Proje künyesi' })).toHaveCount(0)
    await expect(page.locator('header').getByRole('list', { name: 'Kategori' }).getByRole('link')).toHaveCount(1)
    // The closing band sits directly on the footer (no dead strip).
    await expect(page.locator('main > [data-end-band]')).toBeVisible()
    expect(await page.locator('footer').evaluate((el) => getComputedStyle(el).marginTop)).toBe('0px')
    await expect(page.getByText('Çok memnun kaldık.')).toBeVisible()
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
  })

  test('index filters by category through the URL', async ({ page }) => {
    await page.goto('/tr/projeler')
    await expect(page.getByRole('link', { name: new RegExp(full.title) })).toBeVisible()
    await page.goto(`/tr/projeler?kategori=${categorySlug}`)
    await expect(page.getByRole('link', { name: new RegExp(bare.title) })).toBeVisible()
    await page.goto('/tr/projeler?kategori=boyle-bir-kategori-yok')
    await expect(page.getByRole('link', { name: new RegExp(bare.title) })).toBeVisible() // unknown/unused filter → all projects
  })

  test('references list names, locations and linked projects', async ({ page }) => {
    const row = page.locator('li', { hasText: `E2E Referans ${stamp}` })
    // The reference is written from this process; a production server may serve the list from its data cache
    // until the revalidation lands, so reload until it shows.
    await expect
      .poll(
        async () => {
          await page.goto('/tr/referanslar')
          return row.count()
        },
        { timeout: 30_000, intervals: [500, 1_000, 2_000] },
      )
      .toBeGreaterThan(0)
    await expect(row).toContainText('Riva / İstanbul')
    // #147: a reference with a project leads with that project's photo, in the full-width grid.
    await expect(row.locator('img')).toBeVisible()
    expect(await row.locator('xpath=..').evaluate((ul) => getComputedStyle(ul).display)).toBe('grid')
    await expect(row.getByRole('link', { name: full.title })).toHaveAttribute(
      'href',
      `/tr/projeler/${full.slug}`,
    )
    await page.goto('/en/references')
    await expect(page.locator('h1')).toHaveText('References')
  })

  test('unknown project is a 404', async ({ page }) => {
    expect((await page.goto('/tr/projeler/boyle-bir-proje-yok'))?.status()).toBe(404)
    // Next may reject a malformed escape itself (400); it must never reach a 500.
    expect([400, 404]).toContain((await page.goto('/tr/projeler/%E0%A4%A'))?.status())
  })
})
