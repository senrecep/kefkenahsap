// #43 cookie banner + Consent Mode v2: GA4 loads only after "Kabul et"; withdrawal stops it. Needs NEXT_PUBLIC_GA_ID.
import { expect, test, type Page } from '@playwright/test'

/** Never reach the real GA property: gtag.js is replaced by a stub that only sets GA-like cookies. */
async function stubGtm(page: Page) {
  const hits: string[] = []
  page.on('request', (r) => r.url().includes('googletagmanager.com') && hits.push(r.url()))
  await page.route('**/*googletagmanager.com/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: "document.cookie='_ga=GA1.1.123; Path=/'; document.cookie='_ga_TEST000000=GS1.1.1; Path=/'" }),
  )
  return hits
}
const gaCookies = async (page: Page) => (await page.context().cookies()).filter((c) => c.name === '_ga' || c.name.startsWith('_ga_'))

test.describe('Cookie consent', () => {
  test('rejecting never requests googletagmanager; footer link reopens the choice', async ({ page }) => {
    const hits = await stubGtm(page)
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
    const hits = await stubGtm(page)
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

  test('withdrawing consent removes GA cookies and stops GA', async ({ page }) => {
    await stubGtm(page)
    await page.goto('/tr')
    await page.getByRole('region', { name: 'Çerez tercihi' }).getByRole('button', { name: 'Kabul et' }).click()
    await expect.poll(async () => (await gaCookies(page)).length).toBe(2)

    await page.getByRole('button', { name: 'Çerez tercihleri' }).click()
    await Promise.all([page.waitForEvent('load'), page.getByRole('region', { name: 'Çerez tercihi' }).getByRole('button', { name: 'Reddet' }).click()])
    expect(await gaCookies(page)).toEqual([])
    expect((await page.context().cookies()).find((c) => c.name === 'kh_consent')?.value).toBe('denied')
    expect(await page.locator('script#ga4').count()).toBe(0)
  })
})
