import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

// #216: a photo whose AI suggestion failed shows "AI önerisi alınamadı" on its grid card, with a retry button that queues it again.
test('Galeri: a failed AI suggestion shows the retry button on the card and retrying re-queues it', async ({ page }) => {
  test.setTimeout(120_000)
  const payload = await getPayload({ config })
  const run = Date.now()
  const testUser = { email: `galeri-ai-${run}@local.test`, password: `galeri-ai-${run}`, name: 'E2E AI', role: 'admin' as const }
  await payload.create({ collection: 'users', data: testUser })
  const cat = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `E2E AI ${run}` } })
  const data = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 100, g: 140, b: 60 } } }).jpeg().toBuffer()
  const photo = await payload.create({
    collection: 'media',
    locale: 'tr',
    context: { skipAi: true },
    data: { category: cat.id, status: 'pending', aiFailure: { code: 'Media.StorageReadFailed', at: new Date().toISOString() } },
    file: { name: `ai-retry-${run}.jpg`, mimetype: 'image/jpeg', size: data.length, data },
  })
  await payload.update({ collection: 'media', id: photo.id, locale: 'tr', context: { skipAi: true }, data: { aiFailure: { code: 'Media.StorageReadFailed', at: new Date().toISOString() } } })

  await login({ page, user: testUser })
  await page.goto('/admin/galeri')
  await page.getByLabel('Kategori').selectOption({ label: `E2E AI ${run}` })
  const card = page.locator('.galeri__card', { hasText: `ai-retry-${run}` })
  await expect(card.locator('.galeri__badge')).toHaveText('AI önerisi alınamadı')
  const retry = card.getByRole('button', { name: 'AI önerisini yeniden dene' })
  expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await retry.click()
  await expect(card.locator('.galeri__badge')).toHaveText(/AI hazırlıyor…|Onay bekliyor/)
  await expect(retry).toHaveCount(0)
  const after = await payload.findByID({ collection: 'media', id: photo.id, locale: 'tr', depth: 0 })
  expect(after.aiFailure ?? null).toBeNull()
})
