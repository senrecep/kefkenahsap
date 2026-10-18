import { type APIRequestContext, expect, test } from '@playwright/test'

import { adminApi, createDoc, deleteDocs, uploadPhoto } from '../helpers/content'

// #146: cover, "Bu konudaki işlerimiz", "İlgili yazılar", the focusable table region and the Arabic bidi isolate.
// Self-contained: its own category, photo, project and two guides, written through the running server (REST) so the
// cached loaders are revalidated, and removed afterwards.

const text = (t: string, format = 0) => ({ type: 'text', text: t, detail: 0, format, mode: 'normal', style: '', version: 1 })
const para = (...children: object[]) => ({ type: 'paragraph', children, direction: null, format: '', indent: 0, version: 1, textFormat: 0 })
const cell = (header: boolean, ...children: object[]) => ({
  type: 'tablecell', headerState: header ? 1 : 0, colSpan: 1, rowSpan: 1, format: '', indent: 0, version: 1, direction: null, backgroundColor: null,
  children: [para(...children)],
})
const row = (...cells: object[]) => ({ type: 'tablerow', version: 1, children: cells })
const body = (...children: object[]) => ({ root: { type: 'root', direction: null, format: '', indent: 0, version: 1, children } })
const h2 = (t: string) => ({ type: 'heading', tag: 'h2', children: [text(t)], direction: null, format: '', indent: 0, version: 1 })
// A comparison table whose first column holds an italic Latin binomial, as in the seeded guides.
const table = (head: [string, string], name: string, latin: string, value: string) => ({
  type: 'table', version: 1, format: '', colWidths: null,
  children: [row(cell(true, text(head[0])), cell(true, text(head[1]))), row(cell(false, text(`${name} (`), text(latin, 2), text(')')), cell(false, text(value)))],
})

test.describe('guide finish (#146)', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const slugs = { tr: `e2e-bitis-${stamp}`, ar: `e2e-bitis-ar-${stamp}`, other: `e2e-bitis-diger-${stamp}`, project: `e2e-bitis-proje-${stamp}` }
  const ids = { guides: [] as number[], projects: [] as number[], media: [] as number[], categories: [] as number[] }

  test.beforeAll(async () => {
    api = await adminApi()
    const category = await createDoc(api, 'categories', { name: `E2E Bitiş ${stamp}`, slug: `e2e-bitis-kategori-${stamp}`, _status: 'published' })
    ids.categories.push(category.id)
    const photo = await uploadPhoto(api, { seoFilename: `e2e-bitis-foto-${stamp}`, category: category.id })
    ids.media.push(photo.id)
    ids.projects.push((await createDoc(api, 'projects', { title: `E2E Bitiş projesi ${stamp}`, slug: slugs.project, categories: [category.id], cover: photo.id, _status: 'published' })).id)

    const guide = await createDoc(api, 'guides', {
      title: `E2E Bitiş rehberi ${stamp}`,
      slug: slugs.tr,
      cover: photo.id,
      relatedCategories: [category.id],
      body: body(h2('Birinci başlık?'), para(text('Giriş.')), h2('İkinci başlık?'), table(['Tür', 'Yoğunluk'], 'İroko', 'Milicia excelsa', '660')),
      _status: 'published',
    })
    ids.guides.push(guide.id)
    const ar = await api.patch(`/api/guides/${guide.id}?locale=ar`, {
      data: { title: `دليل ${stamp}`, slug: slugs.ar, body: body(h2('ما الفرق؟'), table(['النوع', 'الكثافة'], 'الإيروكو', 'Milicia excelsa', '660')), _status: 'published' },
    })
    expect(ar.ok(), await ar.text()).toBe(true)
    ids.guides.push((await createDoc(api, 'guides', { title: `E2E Diğer rehber ${stamp}`, slug: slugs.other, relatedCategories: [category.id], body: body(para(text('Kısa.'))), _status: 'published' })).id)
  })

  test.afterAll(async () => {
    await deleteDocs(api, 'guides', ids.guides)
    await deleteDocs(api, 'projects', ids.projects)
    await deleteDocs(api, 'media', ids.media)
    await deleteDocs(api, 'categories', ids.categories)
  })

  test('cover, related projects and guides, focusable labelled table', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect.poll(async () => (await page.goto(`/tr/rehber/${slugs.tr}`))?.status(), { timeout: 20_000 }).toBe(200)

    // The cover sits between the lede and the article grid, before the first H2.
    const cover = page.locator('article img').first()
    await expect(cover).toBeVisible()
    expect(await cover.getAttribute('src')).toContain(`e2e-bitis-foto-${stamp}`)

    // revalidateTag(…, 'max') serves the stale list once and refreshes behind it: reload until the fixtures show.
    const projects = page.locator('section[aria-labelledby="guide-projects"]')
    await expect(async () => {
      await page.reload()
      await expect(projects.locator(`a[href="/tr/projeler/${slugs.project}"]`)).toBeVisible({ timeout: 1000 })
      await expect(page.locator(`section[aria-labelledby="related-guides"] a[href="/tr/rehber/${slugs.other}"]`)).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 30_000 })
    await expect(projects.getByRole('heading', { name: 'Bu konudaki işlerimiz' })).toBeVisible()
    await expect(projects.locator(`a[href="/tr/projeler/${slugs.project}"]`)).toBeVisible()

    const more = page.locator('section[aria-labelledby="related-guides"]')
    await expect(more.getByRole('heading', { name: 'İlgili yazılar' })).toBeVisible()
    await expect(more.locator(`a[href="/tr/rehber/${slugs.other}"]`)).toBeVisible()
    await expect(more.locator(`a[href="/tr/rehber/${slugs.tr}"]`)).toHaveCount(0) // never itself

    // The scroll region is keyboard-reachable and named, so the sideways scroll works without a mouse.
    const region = page.getByRole('region', { name: 'Tablo (yana kaydırılabilir)' })
    await expect(region).toHaveAttribute('tabindex', '0')
    await region.focus()
    await expect(region).toBeFocused()
  })

  test('Arabic table keeps the Latin binomial in one left-to-right isolate', async ({ page }) => {
    await expect.poll(async () => (await page.goto(`/ar/guides/${slugs.ar}`))?.status(), { timeout: 20_000 }).toBe(200)
    const isolate = page.locator('article table bdi[dir="ltr"]')
    await expect(isolate).toHaveCount(1)
    await expect(isolate).toHaveText('Milicia excelsa')
  })
})
