import { expect, test } from '@playwright/test'

import { PAGE_SIZE } from '../../src/lib/gallery/query'

// Seed-agnostic: asserts structure and ">=" counts, not exact numbers.
test.describe('gallery', () => {
  test('masonry, infinite feed, filters and lightbox', async ({ page }) => {
    await page.goto('/tr/galeri')
    await expect(page.getByRole('heading', { level: 1, name: 'Galeri' })).toBeVisible()
    const visible = page.locator('[data-gallery-item]:visible')
    await expect(visible).toHaveCount(PAGE_SIZE)

    // Scrolling to the end appends the next page from the feed.
    await page.getByRole('link', { name: 'Daha fazla göster' }).scrollIntoViewIfNeeded()
    await expect.poll(() => visible.count()).toBeGreaterThan(PAGE_SIZE)

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
    const chip = page.getByRole('group', { name: 'Kategoriler' }).getByRole('link').nth(1)
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
})
