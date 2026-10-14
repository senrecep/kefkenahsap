import { type APIRequestContext, expect, test } from '@playwright/test'
import sharp from 'sharp'

import { adminApi, createDoc, deleteDocs, uploadPhoto } from '../helpers/content'

// Project template SEO (PLAN §7): metadata, its own OG image, CreativeWork, and ItemList on the projects
// index and references. Self-contained: the seed has no published project, so one is created and removed.

type Node = Record<string, unknown> & { '@type': string }
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Node)
const attr = (html: string, re: RegExp) => html.match(re)?.[1]
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ')

test.describe('project SEO', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const ids = { projects: [] as number[], media: [] as number[], categories: [] as number[], references: [] as number[], tags: [] as number[] }
  const title = `E2E SEO Teras ${stamp}`
  const refName = `E2E SEO Referans ${stamp}`
  let slug = ''

  test.beforeAll(async () => {
    api = await adminApi()
    const category = await createDoc(api, 'categories', { _status: 'published', name: `E2E SEO Kategori ${stamp}`, slug: `e2e-seo-kategori-${stamp}` })
    ids.categories.push(category.id)
    const photos = [await uploadPhoto(api, { seoFilename: `e2e-seo-proje-${stamp}-0`, category: category.id }, 1), await uploadPhoto(api, { seoFilename: `e2e-seo-proje-${stamp}-1`, category: category.id }, 2)]
    ids.media.push(...photos.map((p) => p.id))
    const wood = await createDoc(api, 'tags', { name: `E2E Teak ${stamp}`, axis: 'wood' })
    ids.tags.push(wood.id)
    const ref = await createDoc(api, 'references', { name: refName, location: 'Sarıyer / İstanbul' })
    ids.references.push(ref.id)
    const p = await createDoc<{ id: number; slug: string }>(api, 'projects', {
      _status: 'published',
      title,
      categories: [category.id],
      gallery: photos.map((x) => x.id),
      city: 'İstanbul',
      district: 'Sarıyer',
      year: 2021,
      woodSpecies: [wood.id],
      reference: ref.id,
    })
    ids.projects.push(p.id)
    slug = p.slug
  })

  test.afterAll(async () => {
    for (const [collection, list] of Object.entries(ids)) await deleteDocs(api, collection, list)
  })

  test('project page: metadata, own OG photo and CreativeWork matching the visible facts', async ({ request, baseURL }) => {
    const path = `/tr/projeler/${slug}`
    const html = await (await request.get(path)).text()
    expect(attr(html, /<title>([^<]*)<\/title>/)).toMatch(new RegExp(`^${title} \\| .+`))
    expect(attr(html, /<meta name="robots" content="([^"]*)"/) ?? '').not.toMatch(/noindex/)
    expect(new URL(attr(html, /<link rel="canonical" href="([^"]*)"/)!).pathname).toBe(path)
    expect(attr(html, /<meta property="og:locale" content="([^"]*)"/)).toBe('tr_TR')

    // Its own card (not the site-wide /og.jpg), cropped from a real photo.
    const og = new URL(attr(html, /<meta property="og:image" content="([^"]*)"/)!)
    expect(og.pathname).toMatch(/\/projeler\/.+\/opengraph-image/)
    const res = await request.get(`${baseURL}${og.pathname}${og.search}`)
    expect(res.status()).toBe(200)
    const img = sharp(await res.body())
    expect([(await img.metadata()).width, (await img.metadata()).height]).toEqual([1200, 630])
    expect((await img.stats()).channels.slice(0, 3).map((c) => Math.round(c.mean))).not.toEqual([251, 250, 247])

    const [work] = jsonLd(html).filter((n) => n['@type'] === 'CreativeWork')
    expect(work).toBeTruthy()
    const visible = text(html)
    expect(work!.name).toBe(title)
    expect(visible).toContain(title)
    expect(work!.dateCreated).toBe('2021')
    expect(visible).toContain('2021')
    expect((work!.contentLocation as { name: string }).name).toBe('Sarıyer, İstanbul')
    expect(visible).toContain('Sarıyer, İstanbul')
    expect(work!.material).toEqual([`E2E Teak ${stamp}`])
    expect(visible).toContain(`E2E Teak ${stamp}`)
    expect((work!.image as unknown[]).length).toBe(2)
    expect(new URL(work!.url as string).pathname).toBe(path)
  })

  test('an unknown project slug has no OG image route', async ({ request }) => {
    expect((await request.get(`/tr/projeler/yok-${stamp}/opengraph-image`)).status()).toBe(404)
  })

  test('projects index and references: ItemList of the listed names', async ({ request }) => {
    const index = await (await request.get('/tr/projeler')).text()
    const [list] = jsonLd(index).filter((n) => n['@type'] === 'ItemList')
    const items = list!.itemListElement as { position: number; name: string; url: string }[]
    const mine = items.find((i) => i.name === title)
    expect(mine && new URL(mine.url).pathname).toBe(`/tr/projeler/${slug}`)
    expect(items.map((i) => i.position)).toEqual(items.map((_, n) => n + 1))

    const refs = await (await request.get('/tr/referanslar')).text()
    const [refList] = jsonLd(refs).filter((n) => n['@type'] === 'ItemList')
    expect((refList!.itemListElement as { name: string }[]).map((i) => i.name)).toContain(refName)
    expect(text(refs)).toContain(refName)
  })
})
