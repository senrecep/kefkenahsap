import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

// #203: the Galeri card says whether the other languages follow the TR text, and "Diğer dillere yeniden çevir"
// rewrites them (fake model: "[DE] <TR text>").
test('Galeri: TR edit shows the translation state; "Diğer dillere yeniden çevir" updates every language', async ({ browser }) => {
  test.setTimeout(240_000)
  const payload = await getPayload({ config })
  const run = Date.now()
  const testUser = { email: `galeri-diller-${run}@local.test`, password: `galeri-diller-${run}`, name: 'E2E Diller', role: 'admin' as const }
  await payload.create({ collection: 'users', data: testUser })
  const cat = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `E2E Diller ${run}` } })
  const data = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 140, g: 100, b: 60 } } }).jpeg().toBuffer()
  const photo = await payload.create({
    collection: 'media',
    locale: 'tr',
    context: { skipAi: true },
    data: { category: cat.id, status: 'pending', title: 'Bahçe kamelyası', alt: 'Çam kamelya ve oturma grubu' },
    file: { name: `diller-${run}.jpg`, mimetype: 'image/jpeg', size: data.length, data },
  })

  try {
    for (const [width, height, name] of [[1440, 900, 'desktop'], [390, 844, 'mobile']] as const) {
      const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage()
      await login({ page, user: testUser })
      await page.goto('/admin/galeri')
      await page.getByLabel('Kategori').selectOption({ label: `E2E Diller ${run}` })
      const card = page.locator('.galeri__card', { hasText: 'Bahçe kamelyası' })
      const status = card.locator('.galeri__langs-status')
      await expect(status).toHaveText('Diller: güncel')
      const button = card.getByRole('button', { name: 'Diğer dillere yeniden çevir' })
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48)

      if (name === 'desktop') {
        await card.locator('.galeri__thumb').click()
        await card.getByLabel('Alt metin (fotoğrafta ne görünüyor?)').fill('Çam kamelya, oturma grubu ve çiçeklik')
        await card.getByRole('button', { name: 'Kaydet', exact: true }).click()
        await expect(status).toHaveText('TR değişti, çeviriliyor…')
        if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/screens/admin-galeri-diller-desktop.png', fullPage: true })
        // The dev server's cron runs the job (≤1 min); the card polls every 10 s and flips without a reload.
        await expect(status).toHaveText('Diller: güncel', { timeout: 100_000 })
        const en = await payload.findByID({ collection: 'media', id: photo.id, locale: 'en', fallbackLocale: false, depth: 0 })
        expect(en.alt).toBe('[EN] Çam kamelya, oturma grubu ve çiçeklik')
      }

      page.once('dialog', (d) => void d.accept())
      await button.click()
      await expect(status).toHaveText('Diller: güncel', { timeout: 30_000 })
      const de = await payload.findByID({ collection: 'media', id: photo.id, locale: 'de', fallbackLocale: false, depth: 0 })
      expect(de.alt).toBe('[DE] Çam kamelya, oturma grubu ve çiçeklik')
      expect(de.title).toBe('[DE] Bahçe kamelyası')
      if (name === 'mobile' && process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/screens/admin-galeri-diller-mobile.png', fullPage: true })
      // The same state and button in the photo's edit view.
      await page.goto(`/admin/collections/media/${photo.id}`)
      await expect(page.locator('#field-title')).toHaveValue('Bahçe kamelyası', { timeout: 30_000 })
      const panel = page.locator('.ai-action', { hasText: 'Diğer diller' })
      await expect(panel).toContainText('Diller: güncel')
      await expect(panel.getByRole('button', { name: 'Diğer dillere yeniden çevir' })).toBeEnabled()
      if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: `docs/screens/admin-media-diller-${name}.png`, fullPage: name === 'mobile' })
      await page.context().close()
    }
  } finally {
    await payload.delete({ collection: 'media', where: { category: { equals: cat.id } } })
    await payload.delete({ collection: 'categories', id: cat.id })
    await payload.delete({ collection: 'users', where: { email: { equals: testUser.email } } })
  }
})
