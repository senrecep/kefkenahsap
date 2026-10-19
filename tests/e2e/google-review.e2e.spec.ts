// #229: the owner's Google review link (Site Bilgileri → Sosyal) shows in the footer and on Referanslar only when filled.
import AxeBuilder from '@axe-core/playwright'
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test'

import { routing } from '../../src/i18n/routing'
import type { SiteSetting } from '../../src/payload-types.js'
import { seedTestUser, testUser } from '../helpers/seedUser'

const REVIEW = 'https://g.page/r/CR2jWPAf5IeAEBM/review'
const base = `http://localhost:${process.env.E2E_PORT ?? 3000}`
const referencesPath = routing.pathnames['/referanslar'] as Record<string, string>
let api: APIRequestContext
let original: SiteSetting

const setReview = async (googleReview: string | null) => {
  const res = await api.post('/api/globals/siteSettings?locale=tr', { data: { social: { ...original.social, googleReview } } })
  expect(res.ok()).toBe(true)
}
// The settings write revalidates its tag, but a page rendered earlier may serve once from cache: reload until it matches.
const reviewLinks = (page: Page) => page.locator(`a[href="${REVIEW}"]`)
const gotoUntil = async (page: Page, path: string, count: number) =>
  expect(async () => {
    await page.goto(path)
    await expect(reviewLinks(page)).toHaveCount(count, { timeout: 1000 })
  }).toPass({ timeout: 30_000 })

test.beforeAll(async () => {
  await seedTestUser()
  const { token } = await (await (await request.newContext()).post(`${base}/api/users/login`, { data: testUser })).json()
  api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Authorization: `JWT ${token}` } })
  original = await (await api.get('/api/globals/siteSettings?depth=0&locale=tr')).json()
})
test.afterAll(async () => {
  await api.post('/api/globals/siteSettings?locale=tr', { data: { social: original.social } }).catch(() => {})
})

test.describe('Google review link', () => {
  // Up to two reload-until-fresh waits (30 s each) per test.
  test.describe.configure({ timeout: 90_000 })
  test('renders nothing in the footer or on Referanslar when the field is empty', async ({ page }) => {
    await setReview(null)
    // Only an absolute https link is accepted.
    const http = await api.post('/api/globals/siteSettings?locale=tr', { data: { social: { ...original.social, googleReview: 'http://g.page/r/x/review' } } })
    expect(http.status()).toBe(400)
    await gotoUntil(page, '/tr/referanslar', 0)
    await expect(page.getByText("Google'da yorum bırakın")).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Bizimle çalıştınız mı?' })).toHaveCount(0)
    await gotoUntil(page, '/tr', 0)
    await expect(page.locator('footer').getByText("Google'da yorum bırakın")).toHaveCount(0)
  })

  test('footer link and Referanslar CTA open the review page in a new tab, in every locale', async ({ page }) => {
    await setReview(REVIEW)
    await gotoUntil(page, '/tr/referanslar', 2)
    const footerLink = page.locator('footer').getByRole('link', { name: "Google'da yorum bırakın" })
    await expect(footerLink).toHaveAttribute('href', REVIEW)
    await expect(footerLink).toHaveAttribute('target', '_blank')
    await expect(footerLink).toHaveAttribute('rel', 'noopener noreferrer')
    const cta = page.locator('main section[aria-labelledby="review-h"]')
    await expect(cta.getByRole('heading', { name: 'Bizimle çalıştınız mı?' })).toBeVisible()
    const button = cta.getByRole('link', { name: "Google'da yorum bırakın" })
    await expect(button).toHaveAttribute('target', '_blank')
    await expect(button).toHaveAttribute('rel', 'noopener noreferrer')
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48)

    for (const locale of routing.locales) {
      await gotoUntil(page, `/${locale}${referencesPath[locale]}`, 2)
      await expect(page.locator('main section[aria-labelledby="review-h"] h2')).not.toBeEmpty()
    }
  })

  test('Referanslar with the CTA passes axe (WCAG 2.2 AA)', async ({ page }) => {
    await setReview(REVIEW)
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await gotoUntil(page, '/tr/referanslar', 2)
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
    }
  })
})
