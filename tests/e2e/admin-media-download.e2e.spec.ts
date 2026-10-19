// #230: "İndir" (Galeri card + media edit view) saves the watermarked original as a JPEG; Payload's "Önizleme boyutları"
// drawer scrolls on a phone and its main image opens full size.
import { readFileSync } from 'fs'

import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

let payload: Payload
const run = Date.now()
const user = { email: `indir-${run}@local.test`, password: `indir-${run}`, name: 'E2E İndir', role: 'editor' as const }
let mediaId: number
let categoryId: number
const category = `E2E İndir ${run}`

test.beforeAll(async () => {
  payload = await getPayload({ config })
  await payload.create({ collection: 'users', data: user })
  categoryId = (await payload.create({ collection: 'categories', locale: 'tr', data: { name: category } })).id
  const data = await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 150, g: 105, b: 65 } } }).jpeg().toBuffer()
  const m = await payload.create({
    collection: 'media',
    data: { category: categoryId, seoFilename: `indir-${run}` },
    file: { data, mimetype: 'image/jpeg', name: `indir-${run}.jpg`, size: data.length },
    context: { skipAi: true },
  })
  mediaId = m.id
})
test.afterAll(async () => {
  await payload.delete({ collection: 'media', id: mediaId }).catch(() => {})
  await payload.delete({ collection: 'categories', id: categoryId }).catch(() => {})
  await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
})

async function expectJpegDownload(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download'), click()])
  expect(download.suggestedFilename()).toBe(`indir-${run}.jpg`)
  const meta = await sharp(readFileSync((await download.path())!)).metadata()
  expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1600, 900])
}

test('İndir in the media edit view and on the Galeri card downloads the full-size JPEG', async ({ page }) => {
  test.setTimeout(120_000)
  await login({ page, user })
  await page.goto(`/admin/collections/media/${mediaId}`)
  const edit = page.locator('.media-download').getByRole('link', { name: 'İndir' })
  await expect(edit).toHaveAttribute('href', `/api/media/${mediaId}/download`)
  expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await expectJpegDownload(page, () => edit.click())

  await page.goto('/admin/galeri')
  await page.getByLabel('Kategori').selectOption({ label: category })
  const card = page.locator(`.galeri__card[data-id="${mediaId}"]`)
  const galeri = card.getByRole('link', { name: /^İndir/ })
  const box = (await galeri.boundingBox())!
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48)
  await expectJpegDownload(page, () => galeri.click())
})

test.describe('phone (390×844, touch)', () => {
  test.use({ deviceScaleFactor: 3, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the preview sizes drawer scrolls to its last size and the main image fits and opens full size', async ({ page, context }) => {
    test.setTimeout(120_000)
    // iOS path of the drawer's body-scroll-lock (it reads navigator.platform at load): it cancels every touchmove that the
    // lock's own element (the <dialog>) cannot scroll. That is the iPhone bug; Chromium only takes it with this platform.
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'iPhone' }))
    await login({ page, user })
    await page.goto(`/admin/collections/media/${mediaId}`)
    await page.getByRole('button', { name: /Önizleme Boyutları/i }).click()
    const preview = page.locator('.preview-sizes__preview')
    await expect(preview).toBeVisible()
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0)

    // One vertical scroller, the <dialog> itself: its content is taller than the screen; no nested list scroller.
    const scroller = page.locator('.drawer--is-open')
    const m = await scroller.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }))
    expect(m.sh).toBeGreaterThan(m.ch)
    expect(await page.locator('.preview-sizes__listWrap').evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
    // The image fits the screen width: no sideways overflow in the drawer.
    expect((await preview.boundingBox())!.width).toBeLessThanOrEqual(390)
    expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
    await page.screenshot({ path: test.info().outputPath('drawer.png') })

    // Real touch swipes (touchstart/move/end, which the scroll lock sees; not a programmatic scroll) reach the last size row.
    const last = page.locator('.preview-sizes__sizeOption').last()
    const cdp = await context.newCDPSession(page)
    for (let i = 0; i < 4; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 700 }] })
      for (let y = 680; y >= 200; y -= 40) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await expect(last).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: test.info().outputPath('drawer-scrolled.png') })

    await scroller.evaluate((el) => el.scrollTo(0, 0))
    const [tab] = await Promise.all([context.waitForEvent('page'), preview.tap()])
    // The original (not a size), with Payload's cache-busting query.
    expect(new URL(tab.url()).pathname).toMatch(new RegExp(`/indir-${run}\\.webp$`))
  })
})
