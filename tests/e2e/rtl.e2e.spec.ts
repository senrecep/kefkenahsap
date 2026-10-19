import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { localeDir, routing } from '../../src/i18n/routing'
import { adminApi, createDoc, deleteDocs, uploadPhoto } from '../helpers/content'
import { sitemapText } from '../helpers/sitemap'

// #63: every RTL locale renders right-to-left (dir on <html>), with its own font, mirrored lightbox keys, and
// phone numbers kept left-to-right. A stamped category translated into the locale gives the category page content.

const RTL = routing.locales.filter((l) => localeDir(l) === 'rtl')

for (const l of RTL) {
  test.describe(`${l} (rtl)`, () => {
    let api: APIRequestContext
    const stamp = Date.now()
    const slug = `e2e-${l}-${stamp}`
    const ids = { categories: [] as number[], media: [] as number[] }

    test.beforeAll(async () => {
      api = await adminApi()
      const c = await createDoc(api, 'categories', { _status: 'published', name: `E2E RTL ${stamp}`, slug: `e2e-rtl-${stamp}` })
      ids.categories.push(c.id)
      const res = await api.patch(`/api/categories/${c.id}?locale=${l}`, { data: { name: `أرضيات خشبية ${stamp}`, slug } })
      expect(res.ok(), await res.text()).toBe(true)
      for (let i = 0; i < 3; i++) {
        const m = await uploadPhoto(api, { seoFilename: `e2e-rtl-${stamp}-${i}`, category: c.id }, i)
        ids.media.push(m.id)
        expect((await api.patch(`/api/media/${m.id}?locale=${l}`, { data: { title: `صورة ${i + 1}`, alt: `أرضية خشبية ${i + 1}` } })).ok()).toBe(true)
      }
    })

    // Leave no stale cache behind: the locale has no content again once the fixture is gone.
    test.afterAll(async ({ request }) => {
      await deleteDocs(api, 'media', ids.media)
      await deleteDocs(api, 'categories', ids.categories)
      await expect.poll(async () => sitemapText(request), { timeout: 30_000 }).not.toContain(`/${l}/`)
      const tr = async () => (await (await request.get('/tr')).text()).includes(`<link rel="alternate" hrefLang="${l}"`)
      await expect.poll(tr, { timeout: 30_000 }).toBe(false)
    })

    test('html is rtl, the Arabic font loads, phone numbers stay ltr', async ({ page }) => {
      const fonts: string[] = []
      page.on('request', (r) => r.url().endsWith('.woff2') && fonts.push(r.url()))
      await page.goto(`/${l}`)
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(page.locator('html')).toHaveAttribute('lang', l)
      await page.waitForLoadState('networkidle')
      expect(fonts.some((u) => /NotoSansArabic/.test(u))).toBe(true)
      for (const bdi of await page.locator('a[href^="tel:"] bdi').all()) await expect(bdi).toHaveAttribute('dir', 'ltr')

    })

    test('a page without Arabic text never fetches the Arabic font', async ({ page }) => {
      const fonts: string[] = []
      page.on('request', (r) => r.url().endsWith('.woff2') && fonts.push(r.url()))
      await page.goto('/tr')
      await page.waitForLoadState('networkidle')
      expect(fonts.length).toBeGreaterThan(0)
      expect(fonts.some((u) => /NotoSansArabic/.test(u))).toBe(false)
    })

    test('category page lists the translated service and its photos', async ({ page }) => {
      await expect.poll(async () => (await page.goto(`/${l}/${slug}`))?.status(), { timeout: 20_000 }).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(`أرضيات خشبية ${stamp}`)
      await expect(page.locator('img[alt^="أرضية خشبية"]').first()).toBeVisible()
    })

    test('lightbox: ArrowLeft goes to the next photo, ArrowRight back (mirrored)', async ({ page }) => {
      const res = await page.goto(`/${l}/gallery`)
      expect(res?.status()).toBe(200)
      await page.locator('[data-gallery-item]:visible').first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible()
      await page.keyboard.press('ArrowLeft')
      await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible()
      await page.keyboard.press('ArrowRight')
      await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible()
    })

    test('screenshots at 390 and 1440 (home, category, gallery, contact, mobile menu)', async ({ page }) => {
      test.setTimeout(120_000)
      const shot = async (p: Page, name: string) => p.screenshot({ path: `docs/screens/rtl-${l}-${name}.png` })
      for (const [w, h, size] of [[1440, 900, 'desktop'], [390, 844, 'mobile']] as const) {
        await page.setViewportSize({ width: w, height: h })
        for (const [path, name] of [[`/${l}`, 'home'], [`/${l}/${slug}`, 'category'], [`/${l}/gallery`, 'gallery'], [`/${l}/contact`, 'contact']]) {
          await page.goto(path!)
          await page.waitForLoadState('networkidle')
          await shot(page, `${name}-${size}`)
        }
      }
      await page.goto(`/${l}`)
      await page.locator('button[aria-controls="mobile-menu"]').click()
      await expect(page.locator('#mobile-menu')).toBeVisible()
      await shot(page, 'menu-mobile')
    })
  })
}
