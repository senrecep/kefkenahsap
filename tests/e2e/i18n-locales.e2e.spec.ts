import { expect, test, type APIRequestContext } from '@playwright/test'

import { localeDir, routing } from '../../src/i18n/routing'
import { adminApi, createDoc, deleteDocs } from '../helpers/content'
import { sitemapText } from '../helpers/sitemap'

// #64/#63: every locale in routing.locales is routed and rendered; a locale with no content of its own (no live
// category) is noindex on every fixed route and stays out of hreflang and the sitemap (PLAN §5.1 dil-yayında).
// Assumes the e2e DB has no ru/de/ar content, which is true until real translations are entered.

const NEW = routing.locales.filter((l) => l !== 'tr' && l !== 'en')
const OG: Record<string, string> = { ru: 'ru_RU', de: 'de_DE', ar: 'ar_AR' }
// Fixed, non-search routes: their translated public path in each locale.
const FIXED = Object.entries(routing.pathnames)
  .filter(([k]) => !k.includes('[') && k !== '/ara')
  .map(([, p]) => p)
const pathOf = (p: (typeof FIXED)[number], l: (typeof routing.locales)[number]) => {
  const s = typeof p === 'string' ? p : p[l]
  return s === '/' ? `/${l}` : `/${l}${s}`
}

// Sitemap <loc> of a fixed route in any of the given locales. Photo pages (/xx/galeri/<slug>) are left out on purpose:
// they are legitimately live per locale once the media has a title in it (seeded DB).
const fixedLoc = (ls: readonly (typeof routing.locales)[number][]) =>
  new RegExp(`<loc>[^<]*(${ls.flatMap((l) => FIXED.map((p) => pathOf(p, l))).join('|')})</loc>`)

const page = async (request: APIRequestContext, path: string) => {
  const res = await request.get(path)
  expect(res.status(), path).toBe(200)
  const html = await res.text()
  return {
    html,
    lang: html.match(/<html lang="([^"]+)" dir="([^"]+)"/)?.slice(1),
    robots: html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '',
    og: html.match(/<meta property="og:locale" content="([^"]*)"/)?.[1],
    hreflang: [...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)"/g)].map((m) => m[1]!),
  }
}

test.describe('new locales without content', () => {
  // A fixture deleted moments ago (e.g. by the live test below in an earlier run) is served stale once: wait it out.
  test.beforeAll(async ({ request }) => {
    for (const l of NEW) await expect.poll(async () => (await page(request, `/${l}`)).robots, { timeout: 30_000 }).toContain('noindex')
    await expect.poll(async () => (await page(request, '/tr')).hreflang.some((h) => NEW.includes(h as never)), { timeout: 30_000 }).toBe(false)
    const leaked = fixedLoc(NEW)
    await expect.poll(async () => leaked.test(await sitemapText(request)), { timeout: 30_000 }).toBe(false)
  })

  for (const l of NEW) {
    test(`${l}: every fixed route renders, is noindex and is left out of hreflang`, async ({ request }) => {
      test.setTimeout(120_000) // ~10 routes, each compiled on first hit in dev
      for (const p of FIXED) {
        const path = pathOf(p, l)
        const m = await page(request, path)
        expect(m.lang, path).toEqual([l, localeDir(l)])
        expect(m.robots, path).toContain('noindex')
        expect(m.og, path).toBe(OG[l])
        expect(m.hreflang, path).not.toContain(l)
        expect(m.hreflang, path).toContain('tr')
      }
    })
  }

  test('tr and en pages list no hreflang for a locale without content; the sitemap and llms.txt have none of its URLs', async ({ request }) => {
    for (const path of ['/tr', '/en', '/tr/galeri', '/en/contact']) {
      const m = await page(request, path)
      expect(m.robots, path).not.toContain('noindex')
      for (const l of NEW) expect(m.hreflang, path).not.toContain(l)
    }
    const xml = await sitemapText(request)
    for (const l of NEW) expect(xml, l).not.toMatch(fixedLoc([l]))
    const llms = await (await request.get('/llms.txt')).text()
    for (const l of NEW) expect(llms, l).not.toContain(`Services (${l})`)
  })

  test('`/` never sends a browser to a locale without content: it falls back to tr', async ({ request }) => {
    for (const l of NEW) {
      const res = await request.get('/', { headers: { 'Accept-Language': `${l};q=1` }, maxRedirects: 0 })
      expect(res.status(), l).toBe(302)
      expect(new URL(res.headers()['location']!, 'http://x').pathname, l).toBe('/tr')
    }
  })

  test('the language switcher links only locales with content, plus the current one (no links to noindex shells)', async ({ request }) => {
    const links = (html: string) => [...html.matchAll(/<a href="\/([a-z]{2})" hrefLang="\1"/g)].map((m) => m[1])
    const tr = links((await page(request, '/tr/galeri')).html)
    expect(tr).toEqual(expect.arrayContaining(['tr', 'en']))
    for (const l of NEW) expect(tr, l).not.toContain(l)
    for (const l of NEW) expect(links((await page(request, `/${l}`)).html), l).toEqual(expect.arrayContaining(['tr', 'en', l]))
  })
})

test.describe('a locale goes live with its content (data-driven)', () => {
  let api: APIRequestContext
  const ids: number[] = []
  const l = NEW[0]!
  const stamp = Date.now()

  test.beforeAll(async () => {
    api = await adminApi()
    const c = await createDoc(api, 'categories', { _status: 'published', name: `E2E Dil ${stamp}`, slug: `e2e-dil-${stamp}` })
    ids.push(c.id)
    const res = await api.patch(`/api/categories/${c.id}?locale=${l}`, { data: { name: `E2E ${l} ${stamp}`, slug: `e2e-${l}-${stamp}` } })
    expect(res.ok(), await res.text()).toBe(true)
  })
  // Leave no stale cache behind for later specs: wait until the locale is out of hreflang and the sitemap again.
  test.afterAll(async ({ request }) => {
    await deleteDocs(api, 'categories', ids)
    await expect.poll(async () => (await page(request, '/tr')).hreflang, { timeout: 30_000 }).not.toContain(l)
    await expect.poll(async () => sitemapText(request), { timeout: 30_000 }).not.toMatch(fixedLoc([l]))
  })

  test(`one live ${l} category makes the ${l} fixed routes indexable, in hreflang and in the sitemap`, async ({ request, playwright, baseURL }) => {
    // Cache tags are revalidated stale-while-revalidate ('max'), so the first hit may still be the old page.
    await expect.poll(async () => (await page(request, `/${l}`)).robots, { timeout: 20_000 }).not.toContain('noindex')
    await expect.poll(async () => (await page(request, '/tr')).hreflang, { timeout: 20_000 }).toContain(l)
    await expect.poll(async () => sitemapText(request), { timeout: 20_000 }).toMatch(new RegExp(`<loc>[^<]*/${l}</loc>`))
    expect(await sitemapText(request)).toContain(`/${l}/e2e-${l}-${stamp}`)
    // …the switcher now links it…
    expect((await page(request, '/tr')).html).toMatch(new RegExp(`<a href="/${l}" hrefLang="${l}"`))
    // …and `/` now sends a browser that prefers it there (a fresh context: no NEXT_LOCALE cookie from the visits above).
    const fresh = await playwright.request.newContext({ baseURL })
    const root = await fresh.get('/', { headers: { 'Accept-Language': l }, maxRedirects: 0 })
    expect(new URL(root.headers()['location']!, 'http://x').pathname).toBe(`/${l}`)
  })
})

// #142: the header language menu is a native <details> dropdown; the mobile menu lists the same links open.
test.describe('header language menu', () => {
  test('opens and closes by mouse and keyboard; endonyms, current marked, aligned to the inline end in rtl', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/tr')
    const menu = page.getByRole('navigation', { name: 'Dil' })
    const summary = menu.locator('summary')
    const english = menu.getByRole('link', { name: 'English' })
    await expect(summary).toHaveText(/TR/)
    await expect(english).toBeHidden()

    await summary.click()
    await expect(english).toBeVisible()
    await expect(english).toHaveAttribute('hreflang', 'en')
    await expect(english).toHaveAttribute('lang', 'en')
    await expect(menu.getByRole('link', { name: 'Türkçe' })).toHaveAttribute('aria-current', 'true')
    if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/screens/142-lang-menu-open-1440.png', animations: 'disabled' })
    await page.locator('h1').first().click() // outside click closes
    await expect(english).toBeHidden()
    if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/screens/142-lang-menu-closed-1440.png', animations: 'disabled' })

    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(english).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(menu.getByRole('link', { name: 'Türkçe' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(english).toBeHidden()
    await expect(summary).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(english).toBeVisible()
    await page.keyboard.press('Shift+Tab') // tabbing out of the menu closes it
    await expect(english).toBeHidden()

    await page.goto('/ar')
    const ar = page.getByRole('navigation', { name: 'اللغة' })
    await ar.locator('summary').click()
    const panel = ar.locator('ul')
    await expect(panel).toBeVisible()
    await expect(ar.getByRole('link', { name: 'العربية' })).toHaveAttribute('aria-current', 'true')
    const [d, p] = [await ar.locator('details').boundingBox(), await panel.boundingBox()]
    expect(Math.abs(p!.x - d!.x), 'panel starts at the details’ left (inline-end) edge').toBeLessThan(1)
    if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/screens/142-lang-menu-open-ar-1440.png', animations: 'disabled' })
  })

  test('mobile: the menu panel lists the languages open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const [l, name, current] of [['tr', 'Dil', 'Türkçe'], ['ar', 'اللغة', 'العربية']] as const) {
      await page.goto(`/${l}`)
      if (l === 'tr' && process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/screens/142-lang-menu-closed-390.png', animations: 'disabled' })
      await page.locator('button[aria-controls="mobile-menu"]').click()
      const list = page.locator('#mobile-menu').getByRole('navigation', { name })
      await list.scrollIntoViewIfNeeded()
      await expect(list.getByRole('link', { name: current })).toHaveAttribute('aria-current', 'true')
      if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: `docs/screens/142-lang-menu-open-${l === 'tr' ? '' : 'ar-'}390.png`, animations: 'disabled' })
    }
  })
})
