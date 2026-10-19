import { expect, test, type APIRequestContext } from '@playwright/test'

import { adminApi, createDoc, deleteDocs, uploadPhoto } from '../helpers/content'

// PLAN §7 Teknik 6, 8, 9. Self-contained: its own bilingual category (with an FAQ and a titled photo) and a
// Turkish-only one, created through the REST API (so Payload hooks revalidate the cached loaders) and removed.

type Entry = { loc: string; alternates: Record<string, string>; images: string[] }
const path = (u: string) => new URL(u).pathname

async function sitemap(request: APIRequestContext): Promise<Entry[]> {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  const xml = await res.text()
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body!.match(/<loc>([^<]+)<\/loc>/)![1]!,
    alternates: Object.fromEntries([...body!.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1]!, path(m[2]!)])),
    images: [...body!.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1]!),
  }))
}

/** The page is live and indexable, self-canonical, and its hreflang equals the sitemap alternates. */
async function expectIndexable(request: APIRequestContext, u: Entry) {
  let html = ''
  // revalidateTag(…, 'max') serves a stale page once after a fixture write (e.g. the guide index rendered before the
  // first guide was published, still noindex): re-request until the fresh render is there.
  await expect
    .poll(async () => {
      const res = await request.get(path(u.loc))
      expect(res.status(), u.loc).toBe(200)
      html = await res.text()
      return html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? ''
    }, { message: u.loc, timeout: 20_000 })
    .not.toMatch(/noindex/)
  expect(path(html.match(/<link rel="canonical" href="([^"]*)"/)![1]!), u.loc).toBe(path(u.loc))
  const hreflang = Object.fromEntries([...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1]!, path(m[2]!)]))
  expect(hreflang, u.loc).toEqual(u.alternates)
}

test.describe('robots, sitemap, llms.txt', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const ids = { categories: [] as number[], media: [] as number[], guides: [] as number[] }
  const guide = { tr: `e2e-rehber-${stamp}`, en: `e2e-guide-${stamp}` }
  const both = { tr: `e2e-harita-${stamp}`, en: `e2e-map-${stamp}`, trName: `E2E Harita ${stamp}`, enName: `E2E Map ${stamp}` }
  const trOnly = `e2e-yalniz-tr-${stamp}`
  const photo = `e2e-harita-foto-${stamp}`
  const faq = { q: `Harita sorusu ${stamp}?`, a: 'Harita cevabı.' }

  test.beforeAll(async () => {
    api = await adminApi()
    const c = await createDoc(api, 'categories', { _status: 'published', name: both.trName, slug: both.tr, faq: [faq] })
    expect((await api.patch(`/api/categories/${c.id}?locale=en`, { data: { name: both.enName, slug: both.en } })).ok()).toBe(true)
    const t = await createDoc(api, 'categories', { _status: 'published', name: `E2E Yalnız TR ${stamp}`, slug: trOnly })
    ids.categories.push(c.id, t.id)
    const g = await createDoc(api, 'guides', { _status: 'published', title: `E2E rehber ${stamp}`, slug: guide.tr, excerpt: 'Kısa cevap.' })
    expect((await api.patch(`/api/guides/${g.id}?locale=en`, { data: { title: `E2E guide ${stamp}`, slug: guide.en, excerpt: 'Short answer.' } })).ok()).toBe(true)
    ids.guides.push(g.id)
    const m = await uploadPhoto(api, { seoFilename: photo, category: c.id }, 4)
    ids.media.push(m.id)
    for (const [locale, title] of [['tr', `E2E harita fotoğrafı ${stamp}`], ['en', `E2E map photo ${stamp}`]]) {
      expect((await api.patch(`/api/media/${m.id}?locale=${locale}`, { data: { title } })).ok()).toBe(true)
    }
  })

  test.afterAll(async () => {
    await deleteDocs(api, 'guides', ids.guides)
    await deleteDocs(api, 'media', ids.media)
    await deleteDocs(api, 'categories', ids.categories)
  })

  test('robots.txt: non-production blocks everything (dev stays out of the index)', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    expect((await res.text()).trim()).toBe('User-Agent: *\nDisallow: /')
  })

  test('sitemap lists only indexable pages, with alternates that match the page hreflang', async ({ request }) => {
    // Renders ~25 pages (every fixed route in both locales plus the fixtures).
    test.setTimeout(120_000)
    let urls: Entry[] = []
    // Payload's revalidation hook runs after each write; wait for the fixtures to appear.
    // The guide index joins the sitemap once its (cached) guide list has the fixture guide: wait for both.
    await expect
      .poll(async () => (urls = await sitemap(request)).some((u) => path(u.loc) === `/en/gallery/${photo}`) && urls.some((u) => path(u.loc) === '/tr/rehber'), { timeout: 30_000 })
      .toBe(true)
    expect(new Set(urls.map((u) => u.loc)).size).toBe(urls.length)
    const at = (p: string) => urls.find((u) => path(u.loc) === p)

    // Bilingual service: both URLs, each listing both + x-default.
    const trService = at(`/tr/${both.tr}`)
    expect(trService?.alternates).toEqual({ tr: `/tr/${both.tr}`, en: `/en/${both.en}`, 'x-default': `/tr/${both.tr}` })
    expect(at(`/en/${both.en}`)?.alternates).toEqual(trService!.alternates)
    // Turkish-only service: the English page would be noindex, so only Turkish is listed.
    expect(at(`/tr/${trOnly}`)?.alternates).toEqual({ tr: `/tr/${trOnly}`, 'x-default': `/tr/${trOnly}` })
    expect(urls.some((u) => path(u.loc).startsWith('/en/') && path(u.loc).includes(trOnly))).toBe(false)
    // Guide: both locales, and the guide index (listed only once a guide is published in that locale).
    const trGuide = at(`/tr/rehber/${guide.tr}`)
    expect(trGuide?.alternates).toEqual({ tr: `/tr/rehber/${guide.tr}`, en: `/en/guides/${guide.en}`, 'x-default': `/tr/rehber/${guide.tr}` })
    expect(at('/tr/rehber')).toBeTruthy()
    // #233: the material calculator is a fixed, indexable route.
    expect(at('/tr/malzeme-hesaplayici')).toBeTruthy()
    // Photo page with its image (image sitemap extension).
    const photoEntry = at(`/en/gallery/${photo}`)!
    expect(photoEntry.images).toHaveLength(1)
    expect((await request.get(photoEntry.images[0]!)).status()).toBe(200)

    // Every fixed route is listed at least in Turkish; every listed fixed URL is indexable.
    const FIXED = /^\/(tr|en)(\/(galeri|gallery|hizmetlerimiz|services|projeler|projects|referanslar|references|hakkimizda|about|iletisim|contact|kvkk|privacy|cerez-politikasi|cookies|rehber|guides))?$/
    const fixed = urls.filter((u) => FIXED.test(path(u.loc)))
    expect(fixed.filter((u) => path(u.loc).startsWith('/tr')).length).toBe(10)
    for (const u of [...fixed, trGuide!, at(`/en/guides/${guide.en}`)!, trService!, at(`/en/${both.en}`)!, at(`/tr/${trOnly}`)!, photoEntry]) await expectIndexable(request, u)
    // Search is noindex and disallowed: never listed.
    expect(urls.some((u) => /\/(ara|search)$/.test(path(u.loc)))).toBe(false)
  })

  test('llms.txt: Key Facts and live service links; llms-full.txt adds the visible FAQ', async ({ request }) => {
    let short = ''
    await expect.poll(async () => (short = await (await request.get('/llms.txt')).text()).includes(both.trName), { timeout: 20_000 }).toBe(true)
    expect(short).toMatch(/^# .+\n/)
    expect(short).toContain('\n## Key Facts\n')
    expect(short).toMatch(/\n- Name: .+\n/)
    const link = short.match(new RegExp(`\\n- \\[${both.trName}\\]\\((http[^)]+)\\)`))![1]!
    expect(path(link)).toBe(`/tr/${both.tr}`)
    expect((await request.get(path(link))).status()).toBe(200)
    expect(short).toContain(`[${both.enName}](`)
    const full = await (await request.get('/llms-full.txt')).text()
    expect(full).toContain(`### [${both.trName}](`)
    expect(full).toContain(`**${faq.q}**\n${faq.a}`)
  })
})
