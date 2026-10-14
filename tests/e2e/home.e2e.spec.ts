import { expect, test } from '@playwright/test'

import en from '../../messages/en/home.json' with { type: 'json' }
import trCommon from '../../messages/tr/common.json' with { type: 'json' }
import tr from '../../messages/tr/home.json' with { type: 'json' }

test.describe('homepage', () => {
  test('hero, gallery, services and contact in the default order', async ({ page }) => {
    await page.goto('/tr')
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveCount(1)
    await expect(h1).toBeVisible()
    await expect(h1).not.toBeEmpty()

    // Hero photo is the LCP candidate: eager, high priority, full-width sizes.
    const hero = page.locator('main section').first().locator('img')
    await expect(hero).toHaveAttribute('fetchpriority', 'high')
    await expect(hero).toHaveAttribute('sizes', '100vw')
    await expect(page.getByRole('link', { name: trCommon.Cta.quote }).first()).toBeVisible()

    await expect(page.locator('[data-gallery-item]:visible')).not.toHaveCount(0)
    await expect(page.getByRole('link', { name: tr.Home.galleryAll })).toHaveAttribute('href', '/tr/galeri')
    await expect(page.getByRole('heading', { level: 2, name: tr.Home.servicesTitle })).toBeVisible()
    expect(await page.locator('main section h3').count()).toBeGreaterThanOrEqual(5)
    await expect(page.getByRole('table')).toBeVisible()

    const h2s = await page.locator('main h2').allTextContents()
    expect(h2s.indexOf(tr.Home.galleryTitle)).toBeLessThan(h2s.indexOf(tr.Home.servicesTitle))
    expect(h2s.at(-1)).toBe(tr.Home.contactTitle)
  })

  test('hero motion: settles in by default, none with reduced motion', async ({ browser }) => {
    const anim = async (reducedMotion: 'reduce' | 'no-preference') => {
      const page = await (await browser.newContext({ reducedMotion })).newPage()
      await page.goto('/tr')
      const photo = page.locator('main section').first().locator('img').locator('..')
      return photo.evaluate((el) => getComputedStyle(el).animationName)
    }
    expect(await anim('no-preference')).toBe('settle')
    expect(await anim('reduce')).toBe('none')
  })

  test('english homepage', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByRole('heading', { level: 2, name: en.Home.servicesTitle })).toBeVisible()
    await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveCount(1)
  })
})
