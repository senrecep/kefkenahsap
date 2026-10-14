import { type APIRequestContext, expect, test } from '@playwright/test'
import sharp from 'sharp'

import { adminApi, createDoc, deleteDocs, uploadPhoto } from '../helpers/content'

// Category template SEO (PLAN §7): own OG image, Service + FAQPage + BreadcrumbList that repeat the visible text.
// Self-contained: the seed categories have no FAQ yet, so a category with one is created and removed.

type Node = Record<string, unknown> & { '@type': string }
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Node)
const attr = (html: string, re: RegExp) => html.match(re)?.[1]
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ')

test.describe('category SEO', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const ids = { categories: [] as number[], media: [] as number[] }
  const name = `E2E SEO Deck ${stamp}`
  const slug = `e2e-seo-deck-${stamp}`
  const faq = { q: `Deck ne kadar sürede biter ${stamp}?`, a: 'Ölçü ve malzemeye göre birkaç gün sürer.' }

  test.beforeAll(async () => {
    api = await adminApi()
    const c = await createDoc(api, 'categories', { _status: 'published', name, slug, shortDesc: 'Iroko ve teak deck yapıyoruz.', faq: [faq] })
    ids.categories.push(c.id)
    ids.media.push((await uploadPhoto(api, { seoFilename: `e2e-seo-deck-${stamp}-0`, category: c.id }, 3)).id)
  })

  test.afterAll(async () => {
    await deleteDocs(api, 'media', ids.media)
    await deleteDocs(api, 'categories', ids.categories)
  })

  test('own OG photo, and Service / FAQPage / BreadcrumbList match the page', async ({ request, baseURL, page }) => {
    const path = `/tr/${slug}`
    const html = await (await request.get(path)).text()
    expect(attr(html, /<meta name="robots" content="([^"]*)"/) ?? '').not.toMatch(/noindex/)

    const og = new URL(attr(html, /<meta property="og:image" content="([^"]*)"/)!)
    expect(og.pathname).toMatch(new RegExp(`/${slug}/opengraph-image`))
    const res = await request.get(`${baseURL}${og.pathname}${og.search}`)
    expect(res.status()).toBe(200)
    const img = sharp(await res.body())
    const meta = await img.metadata()
    expect([meta.width, meta.height]).toEqual([1200, 630])
    expect((await img.stats()).channels.slice(0, 3).map((c) => Math.round(c.mean))).not.toEqual([251, 250, 247])

    const nodes = jsonLd(html)
    const visible = text(html)
    const [service] = nodes.filter((n) => n['@type'] === 'Service')
    expect(service!.name).toBe(name)
    expect(service!.description).toBe('Iroko ve teak deck yapıyoruz.')
    expect(visible).toContain('Iroko ve teak deck yapıyoruz.')
    expect(new URL(service!.url as string).pathname).toBe(path)
    expect(service!.provider).toEqual({ '@id': expect.stringMatching(/#business$/) })

    const [faqPage] = nodes.filter((n) => n['@type'] === 'FAQPage')
    expect(faqPage!.mainEntity).toEqual([{ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } }])
    expect(visible).toContain(faq.q)
    expect(visible).toContain(faq.a)

    const [crumbs] = nodes.filter((n) => n['@type'] === 'BreadcrumbList')
    const items = crumbs!.itemListElement as { position: number; name: string; item: string }[]
    expect(items.map((i) => i.position)).toEqual([1, 2, 3])
    expect(new URL(items[1]!.item).pathname).toBe('/tr/hizmetlerimiz')
    expect(items[2]).toMatchObject({ name, item: service!.url })
    // PLAN §7: the JSON-LD names are exactly the visible trail.
    await page.goto(path)
    const trail = (await page.getByRole('navigation', { name: 'Konum' }).locator('li').allInnerTexts()).map((t) => t.replace(/\s*\/$/, ''))
    expect(trail).toEqual(items.map((i) => i.name))
  })

  test('unknown category: no OG image route', async ({ request }) => {
    expect((await request.get(`/tr/yok-${stamp}/opengraph-image`)).status()).toBe(404)
  })
})
