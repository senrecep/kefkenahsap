import { type APIRequestContext, expect, test } from '@playwright/test'

import { adminApi, createDoc, deleteDocs } from '../helpers/content'
import { expectTrailMatches } from '../helpers/breadcrumb'

// Guide template SEO (PLAN §7): metadata, Article + FAQPage + BreadcrumbList that repeat only the visible text.
// Self-contained: seed guides are drafts, so two published guides are created through the REST API and removed.

type Node = Record<string, unknown> & { '@type': string }
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Node)
const attr = (html: string, re: RegExp) => html.match(re)?.[1]
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ')

test.describe('guide SEO', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const ids: number[] = []
  const withAuthor = { tr: `e2e-seo-rehber-${stamp}`, en: `e2e-seo-guide-${stamp}`, title: `E2E SEO rehberi ${stamp}`, excerpt: 'Iroko dayanıklı, teak daha yağlıdır.' }
  const noAuthor = { tr: `e2e-seo-rehber-yazarsiz-${stamp}`, title: `E2E yazarsız rehber ${stamp}` }
  const faq = { q: `Hangisi daha uzun ömürlü ${stamp}?`, a: 'Bakımı yapılırsa ikisi de uzun ömürlüdür.' }

  test.beforeAll(async () => {
    api = await adminApi()
    const g = await createDoc(api, 'guides', { _status: 'published', title: withAuthor.title, slug: withAuthor.tr, excerpt: withAuthor.excerpt, faq: [faq], showAuthor: true })
    expect((await api.patch(`/api/guides/${g.id}?locale=en`, { data: { title: `E2E SEO guide ${stamp}`, slug: withAuthor.en, excerpt: 'Iroko is durable.' } })).ok()).toBe(true)
    const h = await createDoc(api, 'guides', { _status: 'published', title: noAuthor.title, slug: noAuthor.tr, showAuthor: false })
    ids.push(g.id, h.id)
  })

  test.afterAll(async () => {
    await deleteDocs(api, 'guides', ids)
  })

  test('guide page: metadata, Article / FAQPage / BreadcrumbList match the page', async ({ request, page }) => {
    const founder = ((await (await api.get('/api/globals/siteSettings?locale=tr&depth=0')).json()) as { founder?: { name?: string | null } }).founder?.name || undefined
    const path = `/tr/rehber/${withAuthor.tr}`
    let html = ''
    await expect.poll(async () => (await request.get(path)).status(), { timeout: 20_000 }).toBe(200)
    html = await (await request.get(path)).text()

    expect(attr(html, /<title>([^<]*)<\/title>/)).toMatch(new RegExp(`^${withAuthor.title} \\| .+`))
    expect(attr(html, /<meta name="robots" content="([^"]*)"/) ?? '').not.toMatch(/noindex/)
    expect(new URL(attr(html, /<link rel="canonical" href="([^"]*)"/)!).pathname).toBe(path)
    expect(attr(html, /<meta property="og:type" content="([^"]*)"/)).toBe('article')
    expect(new URL(attr(html, /<link rel="alternate" hrefLang="en" href="([^"]*)"/)!).pathname).toBe(`/en/guides/${withAuthor.en}`)

    const nodes = jsonLd(html)
    const visible = text(html)
    const [article] = nodes.filter((n) => n['@type'] === 'Article')
    expect(article!.headline).toBe(withAuthor.title)
    expect(article!.description).toBe(withAuthor.excerpt)
    expect(visible).toContain(withAuthor.excerpt)
    expect(new URL(article!.url as string).pathname).toBe(path)
    // dateModified is a visible <time datetime> (the published one when updated within a day of it).
    expect(html).toContain(`dateTime="${article!.dateModified as string}"`)
    expect(new Date(article!.datePublished as string).getTime()).toBeLessThanOrEqual(new Date(article!.dateModified as string).getTime())
    expect((article!.headline as string).length).toBeLessThanOrEqual(110)
    const biz = nodes.find((n) => n['@type'] === 'HomeAndConstructionBusiness')
    expect(article!.publisher).toEqual({ '@id': biz!['@id'] })
    expect(biz!.logo).toBeTruthy()
    // Both dates in the JSON-LD are visible <time> values.
    expect(html).toContain(`dateTime="${article!.datePublished as string}"`)
    if (founder) {
      expect(article!.author).toMatchObject({ '@type': 'Person', name: founder })
      expect(new URL((article!.author as { url: string }).url).pathname).toBe('/tr/hakkimizda')
      expect(visible).toContain(founder)
    } else expect(article).not.toHaveProperty('author')

    const [faqPage] = nodes.filter((n) => n['@type'] === 'FAQPage')
    expect(faqPage!.mainEntity).toEqual([{ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } }])
    expect(visible).toContain(faq.q)
    expect(visible).toContain(faq.a)

    const [crumbs] = nodes.filter((n) => n['@type'] === 'BreadcrumbList')
    const items = crumbs!.itemListElement as { position: number; name: string; item: string }[]
    expect(items.map((i) => i.position)).toEqual([1, 2, 3])
    expect(new URL(items[1]!.item).pathname).toBe('/tr/rehber')
    expect(items[2]).toMatchObject({ name: withAuthor.title, item: article!.url })
    // PLAN §7: the JSON-LD names are exactly the visible trail.
    await page.goto(path)
    await expectTrailMatches(page, items)
  })

  test('byline off: no author; no FAQ shown: no FAQPage; Turkish-only guide has no English hreflang', async ({ request }) => {
    const path = `/tr/rehber/${noAuthor.tr}`
    await expect.poll(async () => (await request.get(path)).status(), { timeout: 20_000 }).toBe(200)
    const html = await (await request.get(path)).text()
    const nodes = jsonLd(html)
    const [article] = nodes.filter((n) => n['@type'] === 'Article')
    expect(article!.headline).toBe(noAuthor.title)
    expect(article).not.toHaveProperty('author')
    expect(article).not.toHaveProperty('description')
    expect(nodes.some((n) => n['@type'] === 'FAQPage')).toBe(false)
    // (The language switcher still links to /en; only the head alternates matter here.)
    expect(html).not.toMatch(/<link rel="alternate" hrefLang="en"/)
  })
})
