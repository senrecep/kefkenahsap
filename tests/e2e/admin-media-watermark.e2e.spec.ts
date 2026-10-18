import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

// #169: an editor uploading through Görseller → Yeni can opt out of the watermark with "Filigran ekleme".
test('Görseller: "Filigran ekleme" stores the upload unmarked', async ({ page }) => {
  test.setTimeout(120_000)
  const payload = await getPayload({ config })
  const run = Date.now()
  const user = { email: `filigran-${run}@local.test`, password: `filigran-${run}`, name: 'E2E Filigran', role: 'editor' as const }
  await payload.create({ collection: 'users', data: user })
  const name = `filigransiz-${run}`
  try {
    await login({ page, user })
    await page.goto('/admin/collections/media/create')
    await page.locator('input[type="file"]').setInputFiles({
      name: `${name}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 90, g: 80, b: 60 } } }).jpeg().toBuffer(),
    })
    await page.getByLabel('Filigran ekleme').check()
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page).toHaveURL(/\/admin\/collections\/media\/\d+/, { timeout: 60_000 })

    const { docs } = await payload.find({ collection: 'media', where: { filename: { equals: `${name}.webp` } }, depth: 0 })
    expect(docs.map((d) => d.watermark)).toEqual(['none'])
    await expect(page.getByText('Eklenmedi', { exact: true })).toBeVisible()
  } finally {
    await payload.delete({ collection: 'media', where: { filename: { equals: `${name}.webp` } } })
    await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
  }
})

test('Galeri: "Filigran ekleme" applies to the next uploads', async ({ page }) => {
  test.setTimeout(120_000)
  const payload = await getPayload({ config })
  const run = Date.now()
  const user = { email: `filigran-g-${run}@local.test`, password: `filigran-g-${run}`, name: 'E2E Filigran', role: 'editor' as const }
  await payload.create({ collection: 'users', data: user })
  const cat = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `E2E Filigran ${run}` } })
  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 90, g: 80, b: 60 } } }).jpeg().toBuffer()
  try {
    await login({ page, user })
    await page.goto('/admin/galeri')
    await page.getByLabel('Kategori').selectOption({ label: `E2E Filigran ${run}` })
    await page.getByLabel(/Filigran ekleme/).check()
    await page.locator('.galeri__add input[type="file"]').setInputFiles({ name: `isaretsiz-${run}.jpg`, mimeType: 'image/jpeg', buffer: photo })
    await expect(page.getByText('1 fotoğraf yüklendi.')).toBeVisible({ timeout: 60_000 })
    await page.getByLabel(/Filigran ekleme/).uncheck()
    await page.locator('.galeri__add input[type="file"]').setInputFiles({ name: `isaretli-${run}.jpg`, mimeType: 'image/jpeg', buffer: photo })
    await expect(page.locator('.galeri__card .galeri__name')).toHaveText([`isaretsiz-${run}.webp`, `isaretli-${run}.webp`], { timeout: 60_000 })

    const { docs } = await payload.find({ collection: 'media', where: { category: { equals: cat.id } }, sort: 'filename', depth: 0 })
    expect(docs.map((d) => [d.filename, d.watermark])).toEqual([
      [`isaretli-${run}.webp`, 'applied'],
      [`isaretsiz-${run}.webp`, 'none'],
    ])
  } finally {
    await payload.delete({ collection: 'media', where: { category: { equals: cat.id } } })
    await payload.delete({ collection: 'categories', id: cat.id })
    await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
  }
})
