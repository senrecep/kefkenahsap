import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

// #55: "AI ile çevir" on a guide edit view; the server answers from the fake model (AI_FAKE_PROVIDER=1).
test('AI ile çevir: fills the empty EN locale of a guide as a draft', async ({ page }) => {
  test.setTimeout(120_000)
  await seedTestUser()
  const payload = await getPayload({ config })
  const run = Date.now()
  const guide = await payload.create({
    collection: 'guides',
    locale: 'tr',
    data: { title: `E2E çeviri ${run}`, excerpt: 'Kamelya yılda bir yağlanır.', _status: 'published' },
  })
  try {
    await login({ page, user: testUser })
    await page.goto(`/admin/collections/guides/${guide.id}`)
    const button = page.getByRole('button', { name: 'AI ile çevir' })
    await expect(button).toBeEnabled()
    await button.click()
    await expect(page.getByText('EN çevirisi taslak olarak kaydedildi.', { exact: false })).toBeVisible({ timeout: 30_000 })
    await page.waitForLoadState('load')

    const en = await payload.findByID({ collection: 'guides', id: guide.id, locale: 'en', fallbackLocale: false, draft: true })
    expect(en._status).toBe('draft')
    expect(en.title).toBe(`[EN] E2E çeviri ${run}`)
    expect(en.excerpt).toBe('[EN] Kamelya yılda bir yağlanır.')
    const published = await payload.findByID({ collection: 'guides', id: guide.id, locale: 'en', fallbackLocale: false, draft: false })
    expect(published.title ?? null).toBeNull()

    // Pressing again: nothing is missing any more → a Turkish error, no second call.
    await page.goto(`/admin/collections/guides/${guide.id}`)
    await page.getByRole('button', { name: 'AI ile çevir' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'çevrilecek eksik dil yok' })).toBeVisible()
  } finally {
    await payload.delete({ collection: 'guides', id: guide.id })
    const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `guides:${guide.id}` } } })
    for (const d of usage.docs) await payload.delete({ collection: 'ai-usage', id: d.id })
  }
})

test('the translate endpoint refuses a request without a signed-in user', async ({ request }) => {
  const res = await request.post('/api/ai/translate', { data: { collection: 'guides', id: 1 } })
  expect(res.status()).toBe(401)
  expect((await res.json()).error).toContain('giriş yapın')
})
