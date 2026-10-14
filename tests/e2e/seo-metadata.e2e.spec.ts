import { expect, test, type APIRequestContext } from '@playwright/test'

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

async function firstImagePath(request: APIRequestContext) {
  const html = await (await request.get('/tr/galeri')).text()
  return html.match(/href="(\/tr\/galeri\/[a-z0-9-]+)"/)![1]!
}

test.describe('page metadata', () => {
  test('public templates are indexable with complete tags', async ({ request }) => {
    const image = await firstImagePath(request)
    for (const [path, og] of [['/tr', 'tr_TR'], ['/en', 'en_US'], ['/tr/galeri', 'tr_TR'], ['/en/gallery', 'en_US'], [image, 'tr_TR']] as const) {
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
  })

  test('paginated gallery duplicates are noindex but keep follow', async ({ request }) => {
    expect((await head(request, '/tr/galeri?sayfa=2')).robots).toBe('noindex, follow')
  })

  test('OG images are real 1200×630 JPEGs (default card and per photo)', async ({ request, baseURL }) => {
    const image = await firstImagePath(request)
    for (const path of ['/tr', image]) {
      const og = new URL((await head(request, path)).ogImage!)
      const res = await request.get(`${baseURL}${og.pathname}${og.search}`)
      expect(res.status(), path).toBe(200)
      expect(res.headers()['content-type']).toBe('image/jpeg')
      const buf = await res.body()
      // JPEG SOF0/SOF2 marker carries height then width.
      const sof = buf.findIndex((b, i) => b === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2))
      expect([buf.readUInt16BE(sof + 7), buf.readUInt16BE(sof + 5)], path).toEqual([1200, 630])
    }
  })
})
