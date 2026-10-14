import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

// #56: "AI ile taslak" on a guide; the server answers from the fake model (AI_FAKE_PROVIDER=1).
test.describe('AI ile taslak', () => {
  test.beforeAll(async () => seedTestUser())

  test('notes → a draft guide body; the published version stays as it was', async ({ page }) => {
    test.setTimeout(120_000)
    const payload = await getPayload({ config })
    const run = Date.now()
    const guide = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `E2E taslak ${run}`, _status: 'published' } })
    try {
      await login({ page, user: testUser })
      await page.goto(`/admin/collections/guides/${guide.id}`)
      await page.getByLabel('AI ile taslak: notlar').fill('- Deck yılda bir yağlanır\n- Önce yıkanır')
      await page.getByRole('button', { name: 'AI ile taslak' }).click()
      await expect(page.getByText('Taslak kaydedildi.', { exact: false })).toBeVisible({ timeout: 30_000 })

      const draft = await payload.findByID({ collection: 'guides', id: guide.id, locale: 'tr', draft: true })
      expect(draft._status).toBe('draft')
      expect(JSON.stringify(draft.body)).toContain('Deck yılda bir yağlanır')
      const published = await payload.findByID({ collection: 'guides', id: guide.id, locale: 'tr', draft: false })
      expect(published.body ?? null).toBeNull()
    } finally {
      await payload.delete({ collection: 'ai-usage', where: { docRef: { equals: `guides:${guide.id}` } } })
      await payload.delete({ collection: 'guides', id: guide.id })
    }
  })

  test('the endpoint ignores _status / draft:false in the request: the result is still only a draft', async ({ request }) => {
    const payload = await getPayload({ config })
    const run = Date.now()
    const guide = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `E2E yayın denemesi ${run}`, _status: 'published' } })
    try {
      const auth = await request.post('/api/users/login', { data: { email: testUser.email, password: testUser.password } })
      expect(auth.ok()).toBe(true)
      const res = await request.post('/api/ai/draft', {
        data: { collection: 'guides', id: guide.id, notes: '- Yayınlanmamalı', _status: 'published', draft: false, data: { _status: 'published' } },
      })
      expect(res.status()).toBe(200)

      const published = await payload.findByID({ collection: 'guides', id: guide.id, locale: 'tr', draft: false })
      expect(published.body ?? null).toBeNull()
      const latest = await payload.findVersions({ collection: 'guides', where: { parent: { equals: guide.id } }, sort: '-updatedAt', limit: 1 })
      expect(latest.docs[0]?.version._status).toBe('draft')
    } finally {
      await payload.delete({ collection: 'ai-usage', where: { docRef: { equals: `guides:${guide.id}` } } })
      await payload.delete({ collection: 'guides', id: guide.id })
    }
  })

  test('refuses a request without a signed-in user', async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: `http://localhost:${process.env.E2E_PORT ?? 3000}` })
    const res = await anon.post('/api/ai/draft', { data: { collection: 'guides', id: 1, notes: '- x' } })
    expect(res.status()).toBe(401)
    await anon.dispose()
  })
})
