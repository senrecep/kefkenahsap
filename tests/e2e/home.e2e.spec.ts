import { expect, test } from '@playwright/test'

test.describe('homepage', () => {
  test('hero, gallery, services and contact in the default order', async ({ page }) => {
    await page.goto('/tr')
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveCount(1)
    await expect(h1).toBeVisible()

    // Hero photo is the LCP candidate: eager, high priority, full-width sizes.
    const hero = page.locator('main section').first().locator('img')
    await expect(hero).toHaveAttribute('fetchpriority', 'high')
    await expect(hero).toHaveAttribute('sizes', '100vw')
    await expect(page.getByRole('link', { name: 'Teklif al' }).first()).toBeVisible()

    await expect(page.locator('[data-gallery-item]:visible')).not.toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Tüm galeriyi gör' })).toHaveAttribute('href', '/tr/galeri')
    await expect(page.getByRole('heading', { level: 2, name: 'Hizmetlerimiz' })).toBeVisible()
    expect(await page.locator('main section h3').count()).toBeGreaterThanOrEqual(5)
    await expect(page.getByRole('table')).toBeVisible()

    const h2s = await page.locator('main h2').allTextContents()
    expect(h2s.indexOf('Yaptığımız işlerden')).toBeLessThan(h2s.indexOf('Hizmetlerimiz'))
    expect(h2s.at(-1)).toBe('İletişim')
  })

  test('english homepage', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByRole('heading', { level: 2, name: 'What we build' })).toBeVisible()
    await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveCount(1)
  })
})
