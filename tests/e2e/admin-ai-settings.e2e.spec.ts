import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

// #57: model picker per task (list from the fake catalog under AI_FAKE_PROVIDER) + this month's cost panel.
test('AI Ayarları: cost panel shows this month, a picked translate model is saved', async ({ page }) => {
  test.setTimeout(120_000)
  await seedTestUser()
  const payload = await getPayload({ config })
  const usage = await payload.create({ collection: 'ai-usage', data: { task: 'translate', ok: true, model: 'fake/model-a', costUsd: 0.5, docRef: 'e2e:57' } })
  try {
    await login({ page, user: testUser })
    await page.goto('/admin/globals/aiSettings')

    const panel = page.getByRole('region', { name: 'Bu ayın AI maliyeti' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('row', { name: /Çeviri/ })).toBeVisible()

    const translate = page.getByRole('group', { name: 'Çeviri modelleri' })
    await expect(translate.locator('datalist option[value="fake/model-b"]')).toHaveCount(1)
    await translate.getByRole('button', { name: 'Model ekle' }).click()
    await translate.getByRole('combobox', { name: 'Çeviri modelleri: 1. model' }).fill('fake/model-b')
    const saved = page.waitForResponse((r) => r.url().includes('/api/globals/aiSettings') && r.request().method() === 'POST' && r.ok())
    await page.locator('#action-save').click()
    await saved

    const settings = await payload.findGlobal({ slug: 'aiSettings' })
    expect(settings.translate).toEqual(['fake/model-b'])
  } finally {
    await payload.updateGlobal({ slug: 'aiSettings', data: { translate: [] } })
    await payload.delete({ collection: 'ai-usage', id: usage.id })
  }
})
