// #256: "Şablon seç" on a lead-prefilled draft fills subject + body with the lead's data; the preview shows the buttons;
// "Gönder" asks again while [..] parts are unfilled (dismissed here, so nothing is ever sent).
import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

let payload: Payload
const run = Date.now()
const user = { email: `sablon-${run}@local.test`, password: `sablon-${run}`, name: 'E2E Şablon', role: 'editor' as const }
let leadId: number
let doneTemplateId: number

test.beforeAll(async () => {
  // This process must not mail the lead notification (a real key may be in .env).
  delete process.env.RESEND_API_KEY
  payload = await getPayload({ config })
  await payload.create({ collection: 'users', data: user })
  leadId = (await payload.create({ collection: 'leads', data: { name: `Ayşe ${run}`, phone: '905321112233', email: `ayse-${run}@example.com`, service: 'Deck', consentKvkk: true } })).id
  doneTemplateId = (await payload.find({ collection: 'email-templates', where: { name: { equals: 'İş tamamlandı' } }, limit: 1 })).docs[0]!.id
})
test.afterAll(async () => {
  await payload.delete({ collection: 'outgoing-emails', where: { lead: { equals: leadId } } })
  await payload.delete({ collection: 'leads', id: leadId }).catch(() => {})
  await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
})

const editor = (page: Page) => page.locator('.field-type.rich-text-lexical [contenteditable="true"]')

async function save(page: Page) {
  await expect(async () => {
    await page.locator('#action-save').click()
    await page.waitForURL(/\/admin\/collections\/outgoing-emails\/\d+$/, { timeout: 5_000 })
  }).toPass({ timeout: 45_000 })
  return Number(page.url().split('/').pop())
}

test('a template fills a lead reply; the preview has its buttons; unfilled parts make "Gönder" ask again', async ({ page }) => {
  test.setTimeout(150_000)
  await login({ page, user })
  await page.goto(`/admin/collections/outgoing-emails/create?lead=${leadId}`)
  await expect(page.locator('#field-subject')).toHaveValue('Talebiniz hakkında — Deck')

  const picker = page.getByLabel('Şablondan başla')
  expect((await picker.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await picker.selectOption({ label: 'Teklif cevabı — Siteden veya e-postayla gelen ilk talebe cevap.' })
  await expect(page.locator('#field-subject')).toHaveValue('Talebiniz hakkında — Deck')
  await expect(editor(page)).toContainText(`Merhaba Ayşe ${run},`)
  await expect(editor(page).locator('strong', { hasText: 'Deck' })).toBeVisible()
  await expect(editor(page)).toContainText('İyi günler dileriz,')

  const id = await save(page)
  const doc = await payload.findByID({ collection: 'outgoing-emails', id, depth: 0 })
  expect(doc.lead).toBe(leadId)
  const html = await (await page.request.get(`/api/outgoing-emails/${id}/preview`)).text()
  expect(html).toContain(`Merhaba Ayşe ${run},`)
  expect(html).toMatch(/bgcolor="#0b7a3e"[^>]*><a href="https:\/\/wa\.me\/905322958416"[^>]*>WhatsApp&#39;tan yazın<\/a>/)
  expect(html).toMatch(/border:2px solid #0b7a3e[^>]*><a href="https:\/\/www\.kefkenahsap\.com\/tr\/galeri"[^>]*>Yaptığımız işler<\/a>/)

  // A written body is replaced only after confirming.
  let asked = ''
  page.once('dialog', (d) => {
    asked = d.message()
    void d.accept()
  })
  await page.getByLabel('Şablondan başla').selectOption({ label: 'Keşif randevusu teyidi — Ölçü/keşif günü kesinleşince.' })
  expect(asked).toContain('Keşif randevusu teyidi')
  await expect(page.locator('#field-subject')).toHaveValue('Keşif randevunuz — Deck')
  await expect(editor(page)).toContainText('[gün, tarih]')
  await save(page)

  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.dismiss()
  })
  await page.getByRole('button', { name: 'Gönder' }).click()
  await expect.poll(() => dialogs.length).toBe(1)
  expect(dialogs[0]).toContain('Doldurulmamış alanlar var: [gün, tarih], [saat], [adres]')
  expect((await payload.findByID({ collection: 'outgoing-emails', id, depth: 0 })).status).toBe('draft')
})

test('?template= opens the draft already filled from that template', async ({ page }) => {
  test.setTimeout(120_000)
  await login({ page, user })
  await page.goto(`/admin/collections/outgoing-emails/create?lead=${leadId}&template=${doneTemplateId}`)
  await expect(page.locator('#field-to')).toHaveValue(`ayse-${run}@example.com`)
  await expect(page.locator('#field-subject')).toHaveValue('İşiniz tamamlandı — teşekkür ederiz')
  await expect(editor(page)).toContainText('Deck işinizi tamamladık.')
  await expect(editor(page)).toContainText(`Merhaba Ayşe ${run},`)
})
