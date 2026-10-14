import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// #26: upload through the Galeri view, reorder with ↑, approve after adding Turkish alt text.
test('Galeri: upload two photos, move the second up, approve with alt text', async ({ browser }) => {
  test.setTimeout(180_000)
  await seedTestUser()
  const payload = await getPayload({ config })
  const run = Date.now()
  const cat = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `E2E Galeri ${run}` } })
  const photo = async (r: number, g: number, b: number) =>
    sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r, g, b } } }).jpeg().toBuffer()

  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    await login({ page, user: testUser })
    await page.goto('/admin/galeri')
    await page.getByLabel('Kategori').selectOption({ label: `E2E Galeri ${run}` })
    await expect(page.getByText('Bu kategoride henüz fotoğraf yok.')).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles([
      { name: `birinci-${run}.jpg`, mimeType: 'image/jpeg', buffer: await photo(160, 110, 60) },
      { name: `ikinci-${run}.jpg`, mimeType: 'image/jpeg', buffer: await photo(60, 110, 160) },
    ])
    await expect(page.getByText('2 fotoğraf yüklendi.')).toBeVisible({ timeout: 60_000 })

    const names = page.locator('.galeri__card .galeri__name')
    await expect(names).toHaveText([`birinci-${run}.webp`, `ikinci-${run}.webp`])
    await expect(page.locator('.galeri__badge').first()).toHaveText('AI hazırlıyor…')

    const reordered = page.waitForResponse((r) => r.url().endsWith('/api/reorder') && r.ok())
    await page.getByRole('button', { name: `ikinci-${run}.webp: yukarı taşı` }).click()
    await reordered
    await expect(names).toHaveText([`ikinci-${run}.webp`, `birinci-${run}.webp`])

    // The order is persisted, and the category choice is remembered across reloads.
    await page.reload()
    await expect(names).toHaveText([`ikinci-${run}.webp`, `birinci-${run}.webp`], { timeout: 30_000 })

    const first = page.locator('.galeri__card').first()
    await first.getByRole('button', { name: 'Onayla' }).click()
    await expect(first.getByRole('alert')).toContainText('Türkçe alt metni')
    await first.getByLabel(/Alt metin/).fill('Mavi tonlarda ahşap deck örneği')
    await first.getByRole('button', { name: 'Kaydet ve onayla' }).click()
    await expect(first.locator('.galeri__badge')).toHaveText('Yayında')
    await expect(first.locator('.galeri__alt')).toHaveText('Mavi tonlarda ahşap deck örneği')
    await page.screenshot({ path: 'docs/screens/admin-galeri-mobile.png', fullPage: true })
  } finally {
    await payload.delete({ collection: 'media', where: { category: { equals: cat.id } } })
    await payload.delete({ collection: 'categories', id: cat.id })
    await cleanupTestUser()
  }
})
