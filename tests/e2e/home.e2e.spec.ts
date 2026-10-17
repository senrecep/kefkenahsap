import { expect, test, type Page } from '@playwright/test'

import { adminApi, ensureHeroSlides } from '../helpers/content'

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
    const hero = page.locator('main section').first().locator('img').first()
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
      const photo = page.locator('main section').first().locator('img').first().locator('xpath=ancestor::span[1]')
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
    const hero = section.locator('img').first()
    await expect(hero).toHaveJSProperty('complete', true)
    // The first photo's (a slideshow's next photo may bring its own).
    const source = section.locator('source[media="(max-width: 767px)"]').first()
    await expect(source).toBeAttached()
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

  test('home gallery lightbox steps through exactly the tiles the grid shows', async ({ page }) => {
    await page.goto('/tr')
    const tiles = page.locator('[data-gallery-item]:visible')
    const shown = await tiles.count()
    expect(shown).toBeGreaterThan(0)
    await tiles.first().click()
    await expect(page.getByRole('dialog').getByText(new RegExp(`^1 / ${shown}$`))).toBeVisible()
  })

  test('gallery category chips link into the filtered gallery', async ({ page }) => {
    await page.goto('/tr')
    const chips = page.getByRole('group', { name: 'Hizmet' }).getByRole('link')
    // Seed-agnostic: one chip per published category (CI has a single fixture category).
    expect(await chips.count()).toBeGreaterThanOrEqual(1)
    for (const href of await chips.evaluateAll((a) => a.map((x) => x.getAttribute('href')))) expect(href).toMatch(/^\/tr\/galeri\?kategori=[a-z0-9-]+$/)
    await expect(page.getByRole('group', { name: 'Hizmet' }).locator('[aria-current]')).toHaveCount(0)
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

test.describe('homepage without a hero', () => {
  test('still has exactly one h1 (the page title)', async ({ page }) => {
    test.setTimeout(90_000)
    const api = await adminApi()
    const before = await (await api.get('/api/globals/homepage?depth=0&draft=false')).json()
    const save = async (data: Record<string, unknown>) => {
      const res = await api.post('/api/globals/homepage', { data })
      expect(res.ok(), await res.text()).toBe(true)
    }
    try {
      await save({ layout: [{ blockType: 'services' }], _status: 'published' })
      // revalidateTag is stale-while-revalidate: the first hit after the write may still serve the old layout.
      await expect(async () => {
        await page.goto('/tr')
        await expect(page.locator('main section img[fetchpriority="high"][sizes="100vw"]')).toHaveCount(0, { timeout: 1000 })
      }).toPass({ timeout: 30_000 })
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toHaveCount(1)
      await expect(h1).toHaveText(tr.Home.heroTitle)
    } finally {
      await save({ layout: before.layout ?? [], _status: before._status ?? 'draft' })
    }
  })
})

test.describe('hero slideshow (#187)', () => {
  let restore = async () => {}
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000)
    restore = await ensureHeroSlides(await adminApi())
    // revalidateTag is stale-while-revalidate (and the test before rewrites the homepage): wait for the slideshow.
    await expect(async () => expect(await (await request.get('/tr')).text()).toContain('aria-roledescription="carousel"')).toPass({ timeout: 45_000 })
  })
  test.afterAll(async () => {
    test.setTimeout(60_000)
    await restore()
  })

  const hero = (page: Page) => page.locator('main section').first()
  const dot = (page: Page, n: number) => hero(page).getByRole('button', { name: new RegExp(`^${tr.Home.heroSlide.replace('{n}', String(n)).replace('{total}', '\\d+')}$`) })

  test('the first photo is the server-rendered LCP image; the others are not in the HTML', async ({ page, request }) => {
    const html = await (await request.get('/tr')).text()
    const at = html.indexOf('aria-roledescription="carousel"')
    expect(at).toBeGreaterThan(0)
    const section = html.slice(html.lastIndexOf('<section', at), html.indexOf('</section>', at))
    expect(section.match(/<img /g)).toHaveLength(1)
    expect(section).toMatch(/fetchpriority="high"/i)
    await page.goto('/tr')
    const first = hero(page).locator('img').first()
    await expect(first).toHaveAttribute('fetchpriority', 'high')
    await expect(first).toHaveAttribute('loading', 'eager')
  })

  test('autoplay crossfades to the next photo; pause stops it, the indicators jump', async ({ page }) => {
    await page.clock.install()
    await page.goto('/tr')
    await expect(dot(page, 1)).toHaveAttribute('aria-current', 'true')
    // Load + idle: the second photo is fetched only now, then decoded before it may fade in.
    await page.clock.runFor(3500)
    await expect(hero(page).locator('[data-slide="1"] img')).toHaveJSProperty('complete', true)
    await page.clock.runFor(7000)
    await expect(dot(page, 2)).toHaveAttribute('aria-current', 'true')
    await expect(hero(page).locator('[data-slide="1"]')).toHaveAttribute('aria-hidden', 'false')

    await hero(page).getByRole('button', { name: tr.Home.heroPause }).click()
    await expect(hero(page).getByRole('button', { name: tr.Home.heroPlay })).toBeVisible()
    await page.mouse.move(0, 0) // off the hero: only the pause holds it now
    await page.clock.runFor(20_000)
    await expect(dot(page, 2)).toHaveAttribute('aria-current', 'true')

    await dot(page, 3).click()
    await expect(dot(page, 3)).toHaveAttribute('aria-current', 'true')
    await expect(hero(page).locator('[data-slide="2"]')).toHaveAttribute('aria-hidden', 'false')
    await expect(hero(page).locator('[data-slide="1"]')).toHaveAttribute('aria-hidden', 'true')
  })

  test('reduced motion: no autoplay and no zoom, the play button can still start it', async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage()
    await page.clock.install()
    await page.goto('/tr')
    await expect(hero(page).getByRole('button', { name: tr.Home.heroPlay })).toBeVisible()
    await page.clock.runFor(30_000)
    await expect(dot(page, 1)).toHaveAttribute('aria-current', 'true')
    await dot(page, 2).click()
    await expect(dot(page, 2)).toHaveAttribute('aria-current', 'true')
    expect(await hero(page).locator('[data-slide="1"]').evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
    // The indicators are one tab stop; the arrow keys move along them.
    await page.keyboard.press('ArrowRight')
    await expect(dot(page, 3)).toHaveAttribute('aria-current', 'true')
    await expect(dot(page, 3)).toBeFocused()
    expect(await hero(page).locator('button:not([tabindex="-1"])').count()).toBe(2) // pause + the current indicator
  })

  test('desktop controls take the click (the text block and its scrim lie over the photo layer)', async ({ browser }) => {
    for (const [path, width, height] of [['/de', 1366, 657], ['/tr', 1280, 600]] as const) {
      const page = await (await browser.newContext({ viewport: { width, height } })).newPage()
      await page.goto(path)
      const controls = [hero(page).locator('button').first(), hero(page).getByRole('toolbar').getByRole('button').nth(1)]
      for (const c of controls) {
        const hit = await c.evaluate((el) => {
          const r = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        })
        expect(hit, `${path} ${width}×${height}`).toBe(true)
      }
      await controls[1]!.click()
      await expect(controls[1]!).toHaveAttribute('aria-current', 'true')
      await page.context().close()
    }
  })

  test('320px: only the current indicator shows, and the arrow keys keep focus on it', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' })).newPage()
    await page.goto('/tr')
    await expect(hero(page).getByRole('toolbar').getByRole('button').filter({ visible: true })).toHaveCount(1)
    await dot(page, 1).focus()
    await page.keyboard.press('ArrowRight')
    await expect(dot(page, 2)).toHaveAttribute('aria-current', 'true')
    await expect(dot(page, 2)).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(dot(page, 1)).toBeFocused()
  })

  test('phones: 44px controls between the photo and the title, and a swipe changes the photo', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage()
    await page.goto('/tr')
    const photo = hero(page).locator('[data-slide="0"]')
    const box = (await photo.boundingBox())!
    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!
    for (const b of await hero(page).getByRole('button').all()) {
      const r = (await b.boundingBox())!
      expect(r.width).toBeGreaterThanOrEqual(44)
      expect(r.height).toBeGreaterThanOrEqual(44)
      // Off the photo (they cover none of the work) and above the title.
      expect(r.y).toBeGreaterThanOrEqual(box.y + box.height)
      expect(r.y + r.height).toBeLessThanOrEqual(title.y)
    }
    const y = box.y + box.height / 3
    await photo.dispatchEvent('pointerdown', { clientX: 300, clientY: y, pointerType: 'touch', isPrimary: true })
    await photo.dispatchEvent('pointerup', { clientX: 120, clientY: y, pointerType: 'touch', isPrimary: true })
    await expect(dot(page, 2)).toHaveAttribute('aria-current', 'true')
  })
})
