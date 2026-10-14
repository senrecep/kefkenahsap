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
  const projectSlugs: string[] = []
  let photoSlug = ''

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    api = await adminApi()
    const photo = await uploadPhoto(api, { seoFilename: `e2e-bolge-${stamp}` })
    ids.media.push(photo.id)
    photoSlug = photo.seoFilename
    const a = await createDoc(api, 'regions', { _status: 'published', ...pass, body })
    const b = await createDoc(api, 'regions', { _status: 'published', ...fail, body })
    ids.regions.push(a.id, b.id)
    for (const [region, n] of [[a.id, 3], [b.id, 2]] as const) {
      for (let i = 0; i < n; i++) {
        const slug = `e2e-bolge-proje-${region}-${i}-${stamp}`
        const p = await createDoc(api, 'projects', { _status: 'published', title: `E2E Bölge Projesi ${region}-${i}`, slug, region, gallery: [photo.id], year: 2020 + i })
        ids.projects.push(p.id)
        if (region === a.id) projectSlugs.push(slug)
      }
    }
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
    // No English name/slug → no English page in hreflang.
    expect(html).not.toMatch(/<link rel="alternate" hrefLang="en"/)

    const nodes = jsonLd(html)
    const [service] = nodes.filter((n) => n['@type'] === 'Service')
    expect(service).toMatchObject({ name: pass.name, areaServed: [pass.name] })
    expect(new URL(service!.url as string).pathname).toBe(path)
    const [crumbs] = nodes.filter((n) => n['@type'] === 'BreadcrumbList')
    const items = crumbs!.itemListElement as { position: number; name: string; item: string }[]
    expect(items.map((i) => i.position)).toEqual([1, 2])
    expect(items[1]).toMatchObject({ name: pass.name, item: service!.url })

    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: pass.name })).toBeVisible()
    await expect(page.getByText(sentence).first()).toBeVisible()
    const projects = page.getByRole('region', { name: 'Bu bölgede yaptığımız işler' })
    for (const slug of projectSlugs) await expect(projects.locator(`a[href="/tr/projeler/${slug}"]`)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Bu işlerden fotoğraflar' }).locator(`a[href="/tr/galeri/${photoSlug}"]`)).toHaveCount(1)
    await expect(page.locator('main [data-end-band]')).toBeVisible()
    await expect(page.locator('footer').getByRole('link', { name: pass.name })).toHaveAttribute('href', path)

    // revalidateTag(…, 'max') is stale-while-revalidate: the sitemap may need one more request to catch up.
    await expect.poll(async () => (await request.get('/sitemap.xml')).text(), { timeout: 20_000 }).toContain(`/tr/bolgeler/${pass.slug}</loc>`)
  })

  test('failing region (2 projects): noindex, no canonical, not in the sitemap or footer', async ({ page, request }) => {
    const path = `/tr/bolgeler/${fail.slug}`
    await expect.poll(async () => (await request.get(path)).status(), { timeout: 20_000 }).toBe(200)
    const html = await (await request.get(path)).text()
    expect(attr(html, /<meta name="robots" content="([^"]*)"/)).toMatch(/noindex/)
    expect(html).not.toMatch(/<link rel="canonical"/)

    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: fail.name })).toBeVisible()
    await expect(page.locator('footer').getByRole('link', { name: fail.name })).toHaveCount(0)

    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).not.toContain(fail.slug)
  })

  test('unknown region is a real 404', async ({ request }) => {
    expect((await request.get(`/tr/bolgeler/yok-${stamp}`)).status()).toBe(404)
  })
})
