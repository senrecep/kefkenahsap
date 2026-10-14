// #43 cookie banner + Consent Mode v2: GA4 loads only after "Kabul et". Needs NEXT_PUBLIC_GA_ID (set in .env).
import { expect, test, type Page } from '@playwright/test'

const gtm = (page: Page) => {
  const hits: string[] = []
  // Never send test traffic to the real GA property.
  void page.route('**/*googletagmanager.com/**', (r) => r.abort())
  page.on('request', (r) => r.url().includes('googletagmanager.com') && hits.push(r.url()))
  return hits
}

test.describe('Cookie consent', () => {
  test('rejecting never requests googletagmanager; footer link reopens the choice', async ({ page }) => {
    const hits = gtm(page)
    await page.goto('/tr')
    const banner = page.getByRole('region', { name: 'Çerez tercihi' })
    await expect(banner).toBeVisible()
    // Consent Mode v2 default is in place before any choice.
    expect(await page.evaluate(() => JSON.stringify(window.dataLayer))).toContain('"analytics_storage":"denied"')
    await banner.getByRole('button', { name: 'Reddet' }).click()
    await expect(banner).toBeHidden()
    await page.reload()
    await expect(banner).toBeHidden()
    await page.waitForLoadState('networkidle')
    expect(hits).toHaveLength(0)
    expect((await page.context().cookies()).find((c) => c.name === 'kh_consent')?.value).toBe('denied')

    await page.getByRole('button', { name: 'Çerez tercihleri' }).click()
    await expect(banner).toBeVisible()
  })

  test('accepting loads GA4 with page_locale', async ({ page }) => {
    const hits = gtm(page)
    await page.goto('/en')
    await page.getByRole('region', { name: 'Cookie choice' }).getByRole('button', { name: 'Accept' }).click()
    await expect.poll(() => hits.length).toBeGreaterThan(0)
    expect(hits[0]).toContain('gtag/js?id=G-')
    const dl = await page.evaluate(() => JSON.stringify(window.dataLayer))
    expect(dl).toContain('"page_locale":"en"')
    expect(dl).toContain('"analytics_storage":"granted"')
    await page.reload()
    await expect(page.getByRole('region', { name: 'Cookie choice' })).toBeHidden()
  })
})
