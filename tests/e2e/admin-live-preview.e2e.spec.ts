import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Spike #12: Lexical rich text + drafts + live preview on a localized collection.
test('category edit view offers live preview and a Lexical editor', async ({ browser }) => {
  await seedTestUser()
  const payload = await getPayload({ config })
  const cat = await payload.create({ collection: 'categories', data: { name: 'Önizleme', slug: `onizleme-${Date.now()}` } })
  const page = await (await browser.newContext()).newPage()
  await login({ page, user: testUser })
  await page.goto(`/admin/collections/categories/${cat.id}`)
  await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /önizleme/i }).first().click()
  await expect(page.locator('iframe').first()).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: 'docs/spike/admin-live-preview.png' })
  await payload.delete({ collection: 'categories', id: cat.id })
  await cleanupTestUser()
})
