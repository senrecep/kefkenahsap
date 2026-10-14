// #42 about, legal pages, search page, localized 404. Self-contained: creates its own fixtures (no seed in CI).
import { expect, request, test, type APIRequestContext } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import type { SiteSetting } from '../../src/payload-types.js'
import { seedTestUser, testUser } from '../helpers/seedUser'

const stamp = Date.now()
const base = `http://localhost:${process.env.E2E_PORT ?? 3000}`
const fx = {
  company: `E2E Ahşap ${stamp}`,
  founder: `E2E Usta ${stamp}`,
  district: `Zeytinburnu${stamp}`,
  year: 1999,
  category: `Zeytinlik Kameriye ${stamp}`,
}
let payload: Payload
let api: APIRequestContext
let original: SiteSetting
const ids: { category?: number; media?: number } = {}

test.beforeAll(async () => {
  payload = await getPayload({ config })
  await seedTestUser()
  // Site settings go through the REST API so the running app's hooks revalidate its cache.
  const login = await (await request.newContext()).post(`${base}/api/users/login`, { data: testUser })
  const { token } = await login.json()
  api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Authorization: `JWT ${token}` } })
  original = await (await api.get('/api/globals/siteSettings?depth=0&locale=tr')).json()
  const res = await api.post('/api/globals/siteSettings?locale=tr', {
    data: {
      companyName: fx.company,
      foundingYear: fx.year,
      founder: { ...original.founder, name: fx.founder },
      address: { ...original.address, district: fx.district, city: 'İstanbul' },
    },
  })
  expect(res.ok()).toBe(true)

  // Search results are not cached, so the local API is enough for these.
  const cat = await payload.create({
    collection: 'categories',
    locale: 'tr',
    data: { name: fx.category, shortDesc: 'E2E test kategorisi', _status: 'published' },
  })
  ids.category = cat.id
  const img = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 120, g: 90, b: 50 } } }).webp().toBuffer()
  const media = await payload.create({
    collection: 'media',
    data: {},
    file: { data: img, mimetype: 'image/webp', name: `zeytinlik-${stamp}.webp`, size: img.length },
  })
  // Give the photo a category that already has photos (global-setup's in CI, the seed's locally): if an interrupted
  // run leaves it behind, the gallery still shows it like any other photo, with related photos on its page.
  const peer = await payload.find({ collection: 'media', where: { and: [{ status: { equals: 'approved' } }, { category: { exists: true } }] }, limit: 1, depth: 0 })
  const category = (peer.docs[0]?.category as number | undefined) ?? cat.id
  await payload.update({
    collection: 'media',
    id: media.id,
    locale: 'tr',
    data: { status: 'approved', category, title: `Zeytinlik kameriye ${stamp}`, alt: `Bahçede zeytinlik kameriye ${stamp}` },
  })
  ids.media = media.id
})

test.afterAll(async () => {
  await api
    .post('/api/globals/siteSettings?locale=tr', {
      data: { companyName: original.companyName, foundingYear: original.foundingYear ?? null, founder: original.founder, address: original.address },
    })
    .catch(() => {})
  if (ids.media) await payload.delete({ collection: 'media', id: ids.media }).catch(() => {})
  if (ids.category) await payload.delete({ collection: 'categories', id: ids.category }).catch(() => {})
})

test.describe('Content pages', () => {
  test('about shows only the site settings facts and a contact path', async ({ page }) => {
    await page.goto('/tr/hakkimizda')
    await expect(page.locator('h1')).toBeVisible()
    const main = page.locator('main')
    await expect(main.getByText(String(fx.year), { exact: true })).toBeVisible()
    await expect(main.getByText(fx.founder)).toBeVisible()
    await expect(main.getByText(`${fx.district}, İstanbul`)).toBeVisible()
    await expect(main.getByText(/\d+ yıl/)).toHaveCount(0)
    await expect(main.getByRole('link', { name: 'İletişim ve teklif' })).toHaveAttribute('href', '/tr/iletisim')
    await expect(page).toHaveTitle(new RegExp(fx.company))
    await page.goto('/en/about')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('privacy and cookie pages render in both languages', async ({ page }) => {
    for (const [url, h1] of [
      ['/tr/kvkk', /KVKK|aydınlatma/i],
      ['/en/privacy', /privacy/i],
      ['/tr/cerez-politikasi', /çerez/i],
      ['/en/cookies', /cookie/i],
    ] as const) {
      await page.goto(url)
      await expect(page.locator('h1'), url).toHaveText(h1)
    }
  })

  test('search tolerates typos, groups results and is noindex', async ({ page }) => {
    await page.goto(`/tr/ara?q=${encodeURIComponent('zeytinlik kamerye')}`)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.getByRole('heading', { name: 'Hizmetler' })).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: fx.category, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fotoğraflar' })).toBeVisible()
    await expect(page.locator('main a[href^="/tr/galeri/"]').filter({ hasText: `Zeytinlik kameriye ${stamp}` })).toBeVisible()
  })

  test('search with no results offers the empty state', async ({ page }) => {
    await page.goto('/tr/ara?q=zzqqxxkk')
    await expect(page.getByText(/için bir şey bulamadık/)).toBeVisible()
  })

  test('unknown multi-segment URL → localized 404 with a working search box', async ({ page }) => {
    const res = await page.goto('/tr/boyle-bir-sayfa-yok/alt')
    expect(res?.status()).toBe(404)
    await expect(page.locator('h1')).toHaveText('Bu sayfa bulunamadı')
    await page.getByRole('searchbox', { name: 'Sitede ara' }).fill('zeytinlik')
    await page.getByRole('button', { name: 'Ara', exact: true }).click()
    await expect(page).toHaveURL(/\/tr\/ara\?q=zeytinlik/)
    await expect(page.locator('main').getByRole('link', { name: fx.category, exact: true })).toBeVisible()
  })

  test('unknown single-segment URL → 404', async ({ page }) => {
    // Served by [...rest] here; once /[category] (#38) lands, its notFound() renders the same page.
    const res = await page.goto('/tr/yok-boyle-bir-sayfa')
    expect(res?.status()).toBe(404)
    await expect(page.locator('h1')).toHaveText('Bu sayfa bulunamadı')
  })
})
