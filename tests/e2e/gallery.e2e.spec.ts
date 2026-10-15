import { expect, test } from '@playwright/test'

import { encodeCursor, PAGE_SIZE, START_CURSOR_ID } from '../../src/lib/gallery/query'

// Seed-agnostic: asserts structure and ">=" counts, not exact numbers.
test.describe('gallery', () => {
  test('masonry, infinite feed, filters and lightbox', async ({ page }) => {
    await page.goto('/tr/galeri')
    await expect(page.getByRole('heading', { level: 1, name: 'Galeri' })).toBeVisible()
    const visible = page.locator('[data-gallery-item]:visible')
    await expect(visible).toHaveCount(PAGE_SIZE)
    // LCP (#129): exactly one card, in the phone (2-column) copy, loads eagerly; everything else stays lazy.
    const eager = page.locator('[data-gallery-item] img[loading="eager"]')
    expect(await eager.count()).toBe(1)
    for (const img of await eager.all()) await expect(img.locator('xpath=ancestor::div[contains(@class, "grid-cols-2")]')).toHaveCount(1)

    // Scrolling to the end appends the next page from the feed.
    await page.getByRole('link', { name: 'Daha fazla göster' }).scrollIntoViewIfNeeded()
    await expect.poll(() => visible.count(), { timeout: 20_000 }).toBeGreaterThan(PAGE_SIZE)

    // Lightbox: opens on click, URL follows the image, arrows move, Esc closes and restores the URL.
    await visible.first().click()
    const dialog = page.getByRole('dialog', { name: 'Fotoğraf görüntüleyici' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible()
    await expect(page).toHaveURL(/\/tr\/galeri\/[a-z0-9-]+$/)
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

  test('unfiltered: curated first page, then the feed covers the rest with no repeats', async ({ page, request }) => {
    await page.goto('/tr/galeri')
    const first = await page.locator('[data-gallery-item]:visible').evaluateAll((a) => a.map((x) => x.getAttribute('href')!))
    expect(first).toHaveLength(PAGE_SIZE)
    const seen = new Set(first)
    let cursor: string | null = encodeCursor(START_CURSOR_ID)
    for (let guard = 0; cursor && guard < 60; guard++) {
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
