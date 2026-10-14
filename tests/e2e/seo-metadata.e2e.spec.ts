import { expect, test, type APIRequestContext } from '@playwright/test'
import sharp from 'sharp'

// PLAN §7 Teknik 2–4: every public template has a title, description, self-canonical, hreflang (+ x-default),
// og:locale and a 1200×630 OG image — and never an accidental noindex / nosnippet / max-snippet:0.
// The meta tag is asserted, not the header: non-production responses carry X-Robots-Tag noindex on purpose.

const attr = (html: string, re: RegExp) => html.match(re)?.[1]
const head = async (request: APIRequestContext, path: string) => {
  const res = await request.get(path)
  expect(res.status(), path).toBe(200)
  const html = await res.text()
  return {
    title: attr(html, /<title>([^<]*)<\/title>/),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    robots: attr(html, /<meta name="robots" content="([^"]*)"/),
    canonical: attr(html, /<link rel="canonical" href="([^"]*)"/),
    hreflang: Object.fromEntries([...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])),
    ogLocale: attr(html, /<meta property="og:locale" content="([^"]*)"/),
    ogImage: attr(html, /<meta property="og:image" content="([^"]*)"/),
  }
}

/** First photo page whose stored file is reachable (local DBs can hold uploads whose S3 object is gone). */
async function firstImagePath(request: APIRequestContext) {
  type Item = { href: string; media: { sizes: Record<string, { url: string } | null> } }
  const { items } = (await (await request.get('/tr/galeri/feed')).json()) as { items: Item[] }
  for (const i of items) {
    const src = Object.values(i.media.sizes).find((s) => s?.url)?.url
    if (src && (await request.get(src)).ok()) return i.href
  }
  throw new Error('no gallery photo with a reachable file')
}

test.describe('page metadata', () => {
  test('public templates are indexable with complete tags', async ({ request }) => {
    const image = await firstImagePath(request)
    for (const [path, og] of [['/tr', 'tr_TR'], ['/en', 'en_US'], ['/tr/galeri', 'tr_TR'], ['/en/gallery', 'en_US'], ['/tr/hakkimizda', 'tr_TR'], ['/en/about', 'en_US'], ['/tr/kvkk', 'tr_TR'], ['/en/cookies', 'en_US'], ['/tr/iletisim', 'tr_TR'], ['/en/contact', 'en_US'], ['/tr/projeler', 'tr_TR'], ['/en/references', 'en_US'], ['/tr/hizmetlerimiz', 'tr_TR'], ['/en/decking-and-flooring', 'en_US'], [image, 'tr_TR']] as const) {
      const m = await head(request, path)
      expect(m.title, path).toBeTruthy()
      expect(m.description, path).toBeTruthy()
      expect(m.robots ?? '', path).not.toMatch(/noindex|nosnippet|max-snippet:0/)
      expect(new URL(m.canonical!).pathname, path).toBe(path)
      expect(m.hreflang['x-default'], path).toBeTruthy()
      expect(Object.values(m.hreflang).map((u) => new URL(u).pathname), path).toContain(path)
      expect(m.ogLocale, path).toBe(og)
      expect(m.ogImage, path).toBeTruthy()
    }
  })

  test('titles follow "page | company" (homepage is absolute)', async ({ request }) => {
    expect((await head(request, '/tr/galeri')).title).toMatch(/^Galeri \| .+/)
    expect((await head(request, '/tr')).title).not.toContain(' | ')
    // No doubled suffix on pages that used to append the company name themselves.
    expect((await head(request, '/tr/hakkimizda')).title).toMatch(/^[^|]+ \| [^|]+$/)
  })

  test('expected noindex pages: paginated gallery duplicates and search (follow kept)', async ({ request }) => {
    expect((await head(request, '/tr/galeri?sayfa=2')).robots).toBe('noindex, follow')
    expect((await head(request, '/tr/ara?q=deck')).robots).toBe('noindex, follow')
    expect((await head(request, '/en/search')).robots).toBe('noindex, follow')
  })

  test('OG images are real 1200×630 JPEGs (default card and per photo)', async ({ request, baseURL }) => {
    const image = await firstImagePath(request)
    for (const path of ['/tr', image]) {
      const og = new URL((await head(request, path)).ogImage!)
      const res = await request.get(`${baseURL}${og.pathname}${og.search}`)
      expect(res.status(), path).toBe(200)
      expect(res.headers()['content-type']).toBe('image/jpeg')
      const img = sharp(await res.body())
      const meta = await img.metadata()
      expect([meta.width, meta.height], path).toEqual([1200, 630])
      // A real photo, not the plain paper-coloured fallback card (#fbfaf7).
      const { channels } = await img.stats()
      expect(channels.slice(0, 3).map((c) => Math.round(c.mean)), path).not.toEqual([251, 250, 247])
    }
  })
})
