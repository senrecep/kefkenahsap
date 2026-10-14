import { expect, test, type APIRequestContext } from '@playwright/test'

// PLAN §7 Teknik 6, 8, 9. Seed-agnostic: one sampled URL per template, ">=" counts.

const path = (u: string) => new URL(u).pathname

async function sitemap(request: APIRequestContext) {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  const xml = await res.text()
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body!.match(/<loc>([^<]+)<\/loc>/)![1]!,
    alternates: Object.fromEntries([...body!.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], path(m[2]!)])),
    images: [...body!.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1]!),
  }))
}

test.describe('robots, sitemap, llms.txt', () => {
  test('robots.txt: non-production blocks everything (dev stays out of the index)', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    expect((await res.text()).trim()).toBe('User-Agent: *\nDisallow: /')
  })

  test('sitemap lists only indexable pages, with alternates that match the page hreflang', async ({ request }) => {
    const urls = await sitemap(request)
    expect(new Set(urls.map((u) => u.loc)).size).toBe(urls.length)
    // Every fixed route, plus one service and one photo page.
    const STATIC = /^\/(tr|en)(\/(galeri|gallery|hizmetlerimiz|services|projeler|projects|referanslar|references|hakkimizda|about|iletisim|contact|kvkk|privacy|cerez-politikasi|cookies))?$/
    const statics = urls.filter((u) => STATIC.test(path(u.loc)))
    expect(statics.length).toBe(18) // 9 fixed routes × 2 locales
    const photo = urls.find((u) => /^\/en\/gallery\/./.test(path(u.loc)))
    const service = urls.find((u) => /^\/tr\/[^/]+$/.test(path(u.loc)) && !STATIC.test(path(u.loc)))
    const sample = [...statics, service, photo]
    for (const u of sample) {
      expect(u, 'template present in sitemap').toBeTruthy()
      const res = await request.get(path(u!.loc))
      expect(res.status(), u!.loc).toBe(200)
      const html = await res.text()
      expect(html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '', u!.loc).not.toMatch(/noindex/)
      expect(path(html.match(/<link rel="canonical" href="([^"]*)"/)![1]!), u!.loc).toBe(path(u!.loc))
      const hreflang = Object.fromEntries([...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], path(m[2]!)]))
      expect(hreflang, u!.loc).toEqual(u!.alternates)
    }
    // Image sitemap: every photo page carries its CDN image.
    expect(photo!.images.length).toBe(1)
    expect(photo!.images[0]).toMatch(/^https?:\/\//)
    // Search is noindex and disallowed: never listed.
    expect(urls.some((u) => /\/(ara|search)(\?|$)/.test(path(u.loc)))).toBe(false)
  })

  test('llms.txt has Key Facts and live service links; llms-full.txt is the long form', async ({ request }) => {
    const short = await (await request.get('/llms.txt')).text()
    expect(short).toMatch(/^# .+\n/)
    expect(short).toContain('\n## Key Facts\n')
    expect(short).toMatch(/\n- Name: .+\n/)
    const link = short.match(/\n- \[[^\]]+\]\((http[^)]+)\)/)![1]!
    expect((await request.get(path(link))).status()).toBe(200)
    const full = await (await request.get('/llms-full.txt')).text()
    expect(full).toContain('\n### [')
  })
})
