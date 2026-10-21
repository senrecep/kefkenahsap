// #254: lead → "E-posta gönder" → prefilled draft → save → "Önizle" / "Gönder" (confirm step; dismissed here, so nothing is sent).
import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

let payload: Payload
const run = Date.now()
const user = { email: `giden-${run}@local.test`, password: `giden-${run}`, name: 'E2E Giden', role: 'editor' as const }
let leadId: number

test.beforeAll(async () => {
  // This process must not mail the lead notification (a real key may be in .env).
  delete process.env.RESEND_API_KEY
  payload = await getPayload({ config })
  await payload.create({ collection: 'users', data: user })
  leadId = (await payload.create({ collection: 'leads', data: { name: `Ayşe ${run}`, phone: '905321112233', email: `ayse-${run}@example.com`, service: 'Deck', consentKvkk: true } })).id
})
test.afterAll(async () => {
  await payload.delete({ collection: 'outgoing-emails', where: { lead: { equals: leadId } } })
  await payload.delete({ collection: 'leads', id: leadId }).catch(() => {})
  await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
})

test('a lead reply opens as a prefilled draft that is previewed and sent only after confirming', async ({ page }) => {
  test.setTimeout(120_000)
  await login({ page, user })
  await page.goto(`/admin/collections/leads/${leadId}`)
  const reply = page.getByRole('link', { name: 'E-posta gönder' })
  expect((await reply.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await reply.click()

  await expect(page.locator('#field-to')).toHaveValue(`ayse-${run}@example.com`)
  await expect(page.locator('#field-toName')).toHaveValue(`Ayşe ${run}`)
  await expect(page.locator('#field-subject')).toHaveValue('Talebiniz hakkında — Deck')
  await page.locator('.field-type.rich-text-lexical [contenteditable="true"]').click()
  await page.keyboard.type('Merhaba Ayşe Hanım, keşif için yarın uygunuz.')
  // The rich-text field hands its value to the form asynchronously; an instant save can still see it empty.
  await expect(async () => {
    await page.locator('#action-save').click()
    await page.waitForURL(/\/admin\/collections\/outgoing-emails\/\d+$/, { timeout: 5_000 })
  }).toPass({ timeout: 45_000 })
  const id = Number(page.url().split('/').pop())

  const doc = await payload.findByID({ collection: 'outgoing-emails', id, depth: 0 })
  expect(doc.lead).toBe(leadId)
  expect(doc.status).toBe('draft')

  await expect(page.getByRole('link', { name: 'Önizle' })).toHaveAttribute('href', `/api/outgoing-emails/${id}/preview`)
  const preview = await page.request.get(`/api/outgoing-emails/${id}/preview`)
  expect(await preview.text()).toContain('Merhaba Ayşe Hanım, keşif için yarın uygunuz.')

  const send = page.getByRole('button', { name: 'Gönder' })
  expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  let asked = ''
  page.once('dialog', (d) => {
    asked = d.message()
    void d.dismiss()
  })
  await send.click()
  expect(asked).toContain(`ayse-${run}@example.com`)
  expect((await payload.findByID({ collection: 'outgoing-emails', id, depth: 0 })).status).toBe('draft')
})
