import { expect, test } from '@playwright/test'

import { encodeCursor, PAGE_SIZE, START_CURSOR_ID } from '../../src/lib/gallery/query'

// Seed-agnostic: asserts structure and ">=" counts, not exact numbers.
test.describe('gallery', () => {
  test('masonry, infinite feed, filters and lightbox', async ({ page }) => {
    await page.goto('/tr/galeri')
    await expect(page.getByRole('heading', { level: 1, name: 'Galeri' })).toBeVisible()
    const visible = page.locator('[data-gallery-item]:visible')
    await expect(visible).toHaveCount(PAGE_SIZE)
    // #215: the grid renders once: every card in the DOM is the visible one, each photo exactly once.
    const all = page.locator('[data-gallery-item]')
    await expect(all).toHaveCount(PAGE_SIZE)
    expect(new Set(await all.evaluateAll((a) => a.map((x) => x.getAttribute('href')))).size).toBe(PAGE_SIZE)
    // LCP (#129, #211): the phone layout's first two rows load eagerly, the likeliest LCP card of them with high
    // priority; everything else stays lazy.
    await expect(page.locator('[data-gallery-item] img[loading="eager"]')).toHaveCount(4)
    await expect(page.locator('[data-gallery-item] img[fetchpriority="high"]')).toHaveCount(1)

    // Scrolling to the end appends the next page from the feed.
    await page.getByRole('link', { name: 'Daha fazla göster' }).scrollIntoViewIfNeeded()
    await expect.poll(() => visible.count(), { timeout: 20_000 }).toBeGreaterThan(PAGE_SIZE)

    // Lightbox: opens on click, arrows move, Esc closes; the URL stays on the grid (#226).
    await visible.first().click()
    const dialog = page.getByRole('dialog', { name: 'Fotoğraf görüntüleyici' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/tr\/galeri$/)

    // A category chip filters through a shareable URL.
    const chip = page.getByRole('group', { name: 'Hizmet' }).getByRole('link').nth(1)
    await chip.click()
    await expect(page).toHaveURL(/\?kategori=[a-z0-9-]+/)
    await expect(chip).toHaveAttribute('aria-current', 'page')
    expect(await visible.count()).toBeGreaterThan(0)
  })

  // #226: the lightbox stays open (no document navigation to the photo's page), steps through the grid, and its link
  // opens the photo's page. Checked after a pause: the hard navigation came ~300 ms after the click.
  for (const [path, width] of [['/tr', 390], ['/tr/galeri', 1280]] as const) {
    test(`${path} at ${width}px: the lightbox stays open, steps, and links to the photo page (#226)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 })
      // Umami's tracker (production only) takes over every click on an `a[data-umami-event]`: capture phase,
      // preventDefault, then `location.href = a.href` once the event is sent. That was the hard navigation.
      await page.addInitScript(() =>
        document.addEventListener(
          'click',
          (e) => {
            const a = (e.target as Element).closest?.('a[data-umami-event]') as HTMLAnchorElement | null
            if (!a?.href || a.target === '_blank') return
            e.preventDefault()
            setTimeout(() => (location.href = a.href), 100)
          },
          true,
        ),
      )
      await page.goto(path)
      const tile = page.locator('[data-gallery-item]:visible').first()
      await tile.scrollIntoViewIfNeeded()
      const gridUrl = page.url()
      const scrollY = await page.evaluate(() => window.scrollY)
      await page.evaluate(() => ((window as unknown as { __grid: boolean }).__grid = true))
      const documents: string[] = []
      page.on('request', (r) => r.resourceType() === 'document' && documents.push(r.url()))

      await tile.click()
      const dialog = page.getByRole('dialog', { name: 'Fotoğraf görüntüleyici' })
      await expect(dialog).toBeVisible()
      await page.waitForTimeout(1500)
      await expect(dialog).toBeVisible()
      expect(documents).toEqual([])
      expect(await page.evaluate(() => (window as unknown as { __grid?: boolean }).__grid)).toBe(true)
      await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible()

      // Next (arrow key on desktop, swipe on a phone) changes the photo.
      const title = await dialog.getByRole('heading', { level: 2 }).textContent()
      if (width < 768) {
        const img = dialog.locator('img')
        const box = (await img.boundingBox())!
        const y = box.y + box.height / 2
        await img.dispatchEvent('pointerdown', { clientX: box.x + box.width - 20, clientY: y })
        await img.dispatchEvent('pointerup', { clientX: box.x + 20, clientY: y })
      } else {
        await page.keyboard.press('ArrowRight')
      }
      await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible()
      await expect(dialog.getByRole('heading', { level: 2 })).not.toHaveText(title!)

      // Closing returns to the grid where it was.
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      expect(page.url()).toBe(gridUrl)
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)

      // The lightbox link opens the photo's own page.
      await tile.click()
      await expect(dialog).toBeVisible()
      const photo = (await dialog.getByRole('heading', { level: 2 }).textContent())!
      await dialog.getByRole('link', { name: 'Fotoğrafın sayfası' }).click()
      await expect(page).toHaveURL(/\/tr\/galeri\/[a-z0-9-]+$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(photo)
    })
  }

  test('filters stay compact: types ranked per service, the rest behind "more filters"', async ({ page }) => {
    await page.goto('/tr/galeri')
    const types = page.getByRole('group', { name: 'Ürün türü' }).getByRole('link')
    expect(await types.count()).toBeLessThanOrEqual(8)
    const toggle = page.getByRole('button', { name: 'Daha fazla filtre' })
    // Seed-agnostic: the disclosure exists only when some filter is left over.
    if (await toggle.count()) {
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator('#filter-more')).toBeHidden()
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(page.locator('#filter-more')).toBeVisible()
      // An Etiket filter opens the disclosure on load, its chip current, with one "Temizle" back to everything.
      const tag = page.getByRole('group', { name: 'Etiket' }).getByRole('link').first()
      if (await tag.count()) {
        await tag.click()
        await expect(page).toHaveURL(/\?etiket=[a-z0-9-]+/)
        await expect(page.getByRole('button', { name: 'Daha fazla filtre' })).toHaveAttribute('aria-expanded', 'true')
        await expect(page.getByRole('group', { name: 'Etiket' }).locator('[aria-current="page"]')).toHaveCount(1)
        await page.getByRole('link', { name: 'Temizle' }).click()
        await expect(page).toHaveURL(/\/tr\/galeri$/)
      }
    }
  })

  test('phone: photos start within the first viewport', async ({ browser, baseURL }) => {
    const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 } })
    await page.goto('/tr/galeri')
    const top = await page.locator('[data-gallery-item]:visible').first().evaluate((e) => e.getBoundingClientRect().top)
    expect(top).toBeLessThan(844 / 2)
    await page.close()
  })

  test('without JS every filter stays reachable', async ({ browser, baseURL }) => {
    const page = await browser.newPage({ baseURL, javaScriptEnabled: false })
    await page.goto('/tr/galeri')
    if (await page.locator('#filter-more').count()) await expect(page.locator('#filter-more')).toBeVisible()
    await page.close()
  })

  test('image page with related photos', async ({ page }) => {
    await page.goto('/tr/galeri')
    const href = await page.locator('[data-gallery-item]:visible').first().getAttribute('href')
    await page.goto(href!)
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty()
    await expect(page.getByRole('heading', { name: 'Aynı kategoriden' })).toBeVisible()
    await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveCount(1)
  })

  test('feed handler pages by cursor and rejects bad input', async ({ request }) => {
    const first = await request.get('/tr/galeri/feed')
    expect(first.ok()).toBe(true)
    const body = (await first.json()) as { items: { id: number; href: string }[]; nextCursor: string }
    expect(body.items.length).toBe(PAGE_SIZE)
    const next = (await (await request.get(`/tr/galeri/feed?cursor=${body.nextCursor}`)).json()) as { items: { id: number }[] }
    expect(next.items[0]!.id).toBeLessThan(body.items.at(-1)!.id)
    expect((await request.get('/tr/galeri/feed?cursor=nope')).status()).toBe(400)
    // Cacheable at the edge: no locale cookie on the feed.
    expect(first.headers()['set-cookie']).toBeUndefined()
  })

  test('english gallery and no-JS paging link', async ({ page }) => {
    await page.goto('/en/gallery?sayfa=2')
    await expect(page.getByRole('heading', { level: 1, name: 'Gallery' })).toBeVisible()
    await expect(page.locator('[data-gallery-item]:visible')).toHaveCount(PAGE_SIZE * 2)
    await expect(page.getByRole('link', { name: 'Show more' })).toHaveAttribute('href', /sayfa=3/)
  })

  for (const width of [390, 768, 1280]) {
    test(`masonry at ${width}px: columns of equal width, tiles stacked by the gap, no overlap, grid as tall as its columns (#215)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/tr/galeri')
      // One snapshot of the tiles and the grid: on a short grid (CI's small seed) the feed appends the next page as soon as
      // the page loads, so separate reads could see two different grids.
      const { boxes, ul } = await page.locator('.masonry > ul').evaluate((u) => ({
        boxes: [...u.querySelectorAll<HTMLElement>('[data-gallery-item]')].filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().toJSON() as DOMRect),
        ul: u.getBoundingClientRect().bottom,
      }))
      const cols = [...new Set(boxes.map((b) => Math.round(b.x)))]
      expect(cols).toHaveLength(width < 768 ? 2 : width < 1024 ? 3 : 4)
      expect(new Set(boxes.map((b) => Math.round(b.width))).size).toBe(1)
      const gap = width < 640 ? 8 : width < 768 ? 12 : 16
      for (const x of cols) {
        const col = boxes.filter((b) => Math.round(b.x) === x).sort((p, q) => p.y - q.y)
        for (let i = 1; i < col.length; i++) expect(Math.abs(col[i]!.y - col[i - 1]!.bottom - gap)).toBeLessThan(1)
      }
      expect(Math.abs(ul - Math.max(...boxes.map((b) => b.bottom)))).toBeLessThan(1)
    })
  }

  test('RTL: the masonry mirrors, the first column is on the right (#215)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/ar/gallery')
    const xs = await page.locator('[data-gallery-item]:visible').evaluateAll((a) => a.slice(0, 2).map((x) => x.getBoundingClientRect().x))
    expect(xs[0]!).toBeGreaterThan(xs[1]!)
  })

  test('unfiltered: curated first page, then the feed covers the rest with no repeats', async ({ page, request }) => {
    await page.goto('/tr/galeri')
    const first = await page.locator('[data-gallery-item]:visible').evaluateAll((a) => a.map((x) => x.getAttribute('href')!))
    expect(first).toHaveLength(PAGE_SIZE)
    // The loop guard scales with the data: the lightbox counter gives the total.
    await page.locator('[data-gallery-item]:visible').first().click()
    const counter = await page.getByRole('dialog').getByText(/^1 \/ \d+$/).textContent()
    const total = Number(counter!.split('/')[1])
    await page.keyboard.press('Escape')
    const seen = new Set(first)
    let cursor: string | null = encodeCursor(START_CURSOR_ID)
    for (let guard = 0; cursor && guard <= Math.ceil(total / PAGE_SIZE); guard++) {
      const body = (await (await request.get(`/tr/galeri/feed?cursor=${cursor}`)).json()) as { items: { href: string }[]; nextCursor: string | null }
      for (const i of body.items) {
        expect(seen.has(i.href), i.href).toBe(false)
        seen.add(i.href)
      }
      cursor = body.nextCursor
    }
    expect(cursor).toBeNull()
    // The no-JS pages agree: they include the curated page, with no duplicates.
    await page.goto('/tr/galeri?sayfa=3')
    const paged = await page.locator('[data-gallery-item]:visible').evaluateAll((a) => a.map((x) => x.getAttribute('href')!))
    for (const h of first) expect(paged).toContain(h)
    expect(new Set(paged).size).toBe(paged.length)
  })
})
