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
      // The animated wrapper is the img's nearest span (a phone-crop <picture> may sit in between).
      const photo = page.locator('main section').first().locator('img').locator('xpath=ancestor::span[1]')
      return photo.evaluate((el) => getComputedStyle(el).animationName)
    }
    expect(await anim('no-preference')).toBe('settle')
    expect(await anim('reduce')).toBe('none')
  })

  test('phones load the hero\'s portrait crop and none of its landscape sizes', async ({ browser }) => {
    // Every hero candidate is a large landscape (≥1280 wide; CI's fixtures are 1600x900), so it always has a portrait
    // crop, generated at upload or by scripts/media/add-sizes.ts.
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
    const requested: string[] = []
    page.on('request', (r) => requested.push(r.url()))
    await page.goto('/tr')
    const section = page.locator('main section').first()
    const hero = section.locator('img')
    await expect(hero).toHaveJSProperty('complete', true)
    const source = section.locator('source[media="(max-width: 767px)"]')
    await expect(source).toHaveCount(1)
    const portrait = (await source.getAttribute('srcset'))!.split(', ').map((c) => c.split(' ')[0]!)
    expect(portrait).toContain(await hero.evaluate((img: HTMLImageElement) => img.currentSrc))
    const landscape = (await hero.getAttribute('srcset'))!.split(', ').map((c) => c.split(' ')[0]!)
    expect(landscape.filter((u) => requested.includes(u))).toEqual([])
  })

  test('english homepage', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByRole('heading', { level: 2, name: en.Home.servicesTitle })).toBeVisible()
    await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveCount(1)
  })

  test('gallery category chips link into the filtered gallery', async ({ page }) => {
    await page.goto('/tr')
    const chips = page.getByRole('group', { name: 'Kategoriler' }).getByRole('link')
    // Seed-agnostic: one chip per published category (CI has a single fixture category).
    expect(await chips.count()).toBeGreaterThanOrEqual(1)
    for (const href of await chips.evaluateAll((a) => a.map((x) => x.getAttribute('href')))) expect(href).toMatch(/^\/tr\/galeri\?kategori=[a-z0-9-]+$/)
    await expect(page.getByRole('group', { name: 'Kategoriler' }).locator('[aria-current]')).toHaveCount(0)
  })
})

test.describe('site navigation', () => {
  test('"Projeler" appears in the nav exactly when a project is published', async ({ page }) => {
    await page.goto('/tr/projeler')
    const published = (await page.locator('main ul[aria-labelledby="list-h"] > li').count()) > 0
    await expect(page.getByRole('navigation', { name: trCommon.Nav.menu }).getByRole('link', { name: trCommon.Nav.projects, exact: true })).toHaveCount(published ? 1 : 0)
  })

  test('closing CTA band sits directly on the footer', async ({ page }) => {
    await page.goto('/tr/referanslar')
    await expect(page.locator('main > [data-end-band]')).toBeVisible()
    expect(await page.locator('footer').evaluate((el) => getComputedStyle(el).marginTop)).toBe('0px')
    for (const path of ['/tr/galeri', '/tr/hizmetlerimiz']) {
      await page.goto(path)
      await expect(page.locator('main > [data-end-band]')).toBeVisible()
    }
    await page.goto('/tr/hakkimizda')
    expect(await page.locator('footer').evaluate((el) => getComputedStyle(el).marginTop)).not.toBe('0px')
  })

  test('mobile menu: services collapsed, actions pinned, focus trapped, Esc returns focus', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    await page.goto('/tr')
    const panel = page.locator('#mobile-menu')
    expect(await panel.evaluate((el) => getComputedStyle(el).display)).toBe('none')
    const toggle = page.locator('button[aria-controls="mobile-menu"]')
    await toggle.click()
    await expect(panel).toBeVisible()

    const services = panel.locator('summary', { hasText: trCommon.Nav.services })
    await expect(services).toBeFocused()
    // Seed-agnostic: the disclosure always holds "Tüm hizmetler" plus one link per category.
    const allServices = panel.getByRole('link', { name: trCommon.Nav.allServices })
    await expect(allServices).toBeHidden()
    await expect(panel.getByRole('link', { name: trCommon.Nav.contact, exact: true })).toBeInViewport()
    const quote = panel.getByRole('link', { name: trCommon.Cta.quote })
    await expect(quote).toBeInViewport()
    // WhatsApp renders only when a mobile number is configured (an empty CI DB has none).
    const wa = panel.locator('a[data-umami-event-place="mobile-menu"]')
    if (await wa.count()) await expect(wa).toBeInViewport()

    await services.click()
    await expect(allServices).toBeVisible()
    await expect(quote).toBeInViewport() // still pinned with the list expanded

    // Shift+Tab from the toggle wraps to the panel's last control; Tab from there wraps back to the toggle.
    await toggle.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(quote).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(toggle).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(toggle).toBeFocused()
  })
})
