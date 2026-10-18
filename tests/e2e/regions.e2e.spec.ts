import { type APIRequestContext, expect, test } from '@playwright/test'

import { adminApi, createDoc, deleteDocs, uploadPhoto } from '../helpers/content'

// #59 region pages + publish gate (decision #25). Self-contained: two regions with the same hand-written-length body,
// one with 3 published projects (passes: indexed, in the sitemap and footer) and one with 2 (fails: noindex, unlisted).

type Node = Record<string, unknown> & { '@type': string }
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Node)
const attr = (html: string, re: RegExp) => html.match(re)?.[1]

const text = (t: string) => ({ type: 'text', text: t, detail: 0, format: 0, mode: 'normal', style: '', version: 1 })
const para = (t: string) => ({ type: 'paragraph', children: [text(t)], direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0 })
// 4 paragraphs × 10 sentences × 7 words = 280 words (≥250).
const sentence = 'Bu bölgede deck ve pergola işleri yaptık.'
const body = { root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1, children: Array.from({ length: 4 }, () => para(Array(10).fill(sentence).join(' '))) } }

test.describe('region pages and publish gate', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const ids = { projects: [] as number[], regions: [] as number[], media: [] as number[] }
  const pass = { name: `E2E Bölge Geçer ${stamp}`, slug: `e2e-bolge-gecer-${stamp}` }
  const fail = { name: `E2E Bölge Kalır ${stamp}`, slug: `e2e-bolge-kalir-${stamp}` }
  const passEn = { name: `E2E Area ${stamp}`, slug: `e2e-area-${stamp}` }
  const projectSlugs: string[] = []
  let photoSlug = ''
  let pendingSlug = ''

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    api = await adminApi()
    const photo = await uploadPhoto(api, { seoFilename: `e2e-bolge-${stamp}` })
    ids.media.push(photo.id)
    photoSlug = photo.seoFilename
    // A photo not yet approved must never reach the page, even inside a counted project's gallery.
    const pending = await uploadPhoto(api, { seoFilename: `e2e-bolge-bekleyen-${stamp}`, status: 'pending' }, 3)
    ids.media.push(pending.id)
    pendingSlug = pending.seoFilename
    const a = await createDoc(api, 'regions', { _status: 'published', ...pass, body })
    // English text long enough, but only 2 of its 3 projects have English text → English stays below the gate.
    expect((await api.patch(`/api/regions/${a.id}?locale=en`, { data: { ...passEn, body } })).ok()).toBe(true)
    const b = await createDoc(api, 'regions', { _status: 'published', ...fail, body })
    ids.regions.push(a.id, b.id)
    for (const [region, n] of [[a.id, 3], [b.id, 2]] as const) {
      for (let i = 0; i < n; i++) {
        const slug = `e2e-bolge-proje-${region}-${i}-${stamp}`
        const p = await createDoc(api, 'projects', { _status: 'published', title: `E2E Bölge Projesi ${region}-${i}`, slug, region, gallery: [photo.id, pending.id], year: 2020 + i })
        ids.projects.push(p.id)
        if (region === a.id) projectSlugs.push(slug)
        if (region === a.id && i < 2) {
          const en = { title: `E2E Area project ${region}-${i}`, slug: `e2e-area-project-${region}-${i}-${stamp}` }
          expect((await api.patch(`/api/projects/${p.id}?locale=en`, { data: en })).ok()).toBe(true)
        }
      }
    }
    // A draft third project must not lift the failing region over the gate.
    ids.projects.push((await createDoc(api, 'projects', { _status: 'draft', title: `E2E Bölge Taslak ${stamp}`, slug: `e2e-bolge-taslak-${stamp}`, region: b.id })).id)
  })

  test.afterAll(async () => {
    await deleteDocs(api, 'projects', ids.projects)
    await deleteDocs(api, 'regions', ids.regions)
    await deleteDocs(api, 'media', ids.media)
  })

  test('passing region: indexable page with body, projects, photos, closing band, JSON-LD, sitemap and footer link', async ({ page, request }) => {
    const path = `/tr/bolgeler/${pass.slug}`
    await expect.poll(async () => (await request.get(path)).status(), { timeout: 20_000 }).toBe(200)
    const html = await (await request.get(path)).text()
    expect(attr(html, /<meta name="robots" content="([^"]*)"/) ?? '').not.toMatch(/noindex/)
    expect(new URL(attr(html, /<link rel="canonical" href="([^"]*)"/)!).pathname).toBe(path)
    // The English page exists but fails the gate (2 English projects) → no English hreflang.
    expect(html).not.toMatch(/<link rel="alternate" hrefLang="en"/)

    const nodes = jsonLd(html)
    // A place is not a service: breadcrumbs only.
    expect(nodes.filter((n) => n['@type'] === 'Service')).toEqual([])
    const [crumbs] = nodes.filter((n) => n['@type'] === 'BreadcrumbList')
    const items = crumbs!.itemListElement as { position: number; name: string; item: string }[]
    expect(items.map((i) => i.position)).toEqual([1, 2])
    expect(items[0]!.name).toBe('Ana sayfa')
    expect(new URL(items[0]!.item).pathname).toBe('/tr')
    expect(items[1]!.name).toBe(pass.name)
    expect(new URL(items[1]!.item).pathname).toBe(path)

    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: pass.name })).toBeVisible()
    await expect(page.getByText(sentence).first()).toBeVisible()
    const projects = page.getByRole('region', { name: 'Bu bölgede yaptığımız işler' })
    for (const slug of projectSlugs) await expect(projects.locator(`a[href="/tr/projeler/${slug}"]`)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Bu işlerden fotoğraflar' }).locator(`a[href="/tr/galeri/${photoSlug}"]`)).toHaveCount(1)
    await expect(page.locator(`a[href="/tr/galeri/${pendingSlug}"]`)).toHaveCount(0)
    expect(await page.content()).not.toContain(pendingSlug)
    await expect(page.getByRole('navigation', { name: 'Konum' }).getByRole('link', { name: 'Ana sayfa' })).toHaveAttribute('href', '/tr')
    await expect(page.locator('main [data-end-band]')).toBeVisible()
    await expect(page.locator('footer').getByRole('link', { name: pass.name })).toHaveAttribute('href', path)

    // revalidateTag(…, 'max') is stale-while-revalidate: the sitemap may need one more request to catch up.
    await expect.poll(async () => (await request.get('/sitemap.xml')).text(), { timeout: 20_000 }).toContain(`/tr/bolgeler/${pass.slug}</loc>`)
  })

  test('English page of the passing region: 2 English projects → noindex, and TR lists no English hreflang', async ({ request }) => {
    const path = `/en/areas/${passEn.slug}`
    await expect.poll(async () => (await request.get(path)).status(), { timeout: 20_000 }).toBe(200)
    const html = await (await request.get(path)).text()
    expect(attr(html, /<meta name="robots" content="([^"]*)"/)).toMatch(/noindex/)
    expect(html).not.toMatch(/<link rel="canonical"/)
    expect(jsonLd(html).filter((n) => n['@type'] === 'BreadcrumbList')).toEqual([])
    const tr = await (await request.get(`/tr/bolgeler/${pass.slug}`)).text()
    expect(tr).not.toMatch(/<link rel="alternate" hrefLang="en"/)
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain(passEn.slug)
  })

  test('failing region (2 published projects + 1 draft): noindex, no canonical, not in the sitemap or footer', async ({ page, request }) => {
    const path = `/tr/bolgeler/${fail.slug}`
    await expect.poll(async () => (await request.get(path)).status(), { timeout: 20_000 }).toBe(200)
    const html = await (await request.get(path)).text()
    expect(attr(html, /<meta name="robots" content="([^"]*)"/)).toMatch(/noindex/)
    expect(html).not.toMatch(/<link rel="canonical"/)
    // No English name/slug → no English hreflang; noindex → no JSON-LD.
    expect(html).not.toMatch(/<link rel="alternate" hrefLang="en"/)
    expect(jsonLd(html).filter((n) => n['@type'] === 'BreadcrumbList')).toEqual([])

    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: fail.name })).toBeVisible()
    // The visible trail stays; only its structured data is withheld.
    await expect(page.getByRole('navigation', { name: 'Konum' }).locator('li')).toHaveText(['Ana sayfa', fail.name])
    await expect(page.locator('footer').getByRole('link', { name: fail.name })).toHaveCount(0)

    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).not.toContain(fail.slug)
  })

  test('unknown region is a real 404', async ({ request }) => {
    expect((await request.get(`/tr/bolgeler/yok-${stamp}`)).status()).toBe(404)
  })
})
