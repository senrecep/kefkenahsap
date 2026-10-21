// #256: e-mail templates. Seeded once by the migration (only into an empty table), staff only, bodies valid for the editor
// with its "Buton" block, and a template applied to a lead renders its buttons in the e-mail.
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { outgoingEmailPreviewEndpoint } from '@/endpoints/outgoingEmail'
import { fillTemplate } from '@/lib/email/placeholders'
import { EMAIL_TEMPLATES, seedEmailTemplates } from '@/migrations/20261021_121236_email_templates'
import config from '@/payload.config'

let payload: Payload
let editor: Record<string, unknown>
const created: { collection: 'email-templates' | 'outgoing-emails' | 'users'; id: number }[] = []
const stamp = Date.now()
const names = EMAIL_TEMPLATES.map((t) => t.name)
const seeded = () => payload.find({ collection: 'email-templates', where: { name: { in: names } }, sort: 'order', limit: 100, depth: 0 })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const u = await payload.create({ collection: 'users', data: { email: `templates-${stamp}@local.test`, password: `pw-${stamp}`, name: 'Şablon', role: 'editor' } })
  created.push({ collection: 'users', id: u.id })
  editor = { ...u, collection: 'users' }
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})

describe('email templates (#256)', () => {
  it('the migration seeded the seven owner-approved templates, in order', async () => {
    const { docs } = await seeded()
    expect(docs.map((d) => d.name)).toEqual([
      'Teklif cevabı',
      'Keşif randevusu teyidi',
      'Fiyat teklifi',
      'Teklif hatırlatma',
      'İş başlangıcı',
      'İş tamamlandı',
      'Nazik ret',
    ])
    expect(docs[0]!.subject).toBe('Talebiniz hakkında — {hizmet}')
    expect(docs[0]!.description).toBe('Siteden veya e-postayla gelen ilk talebe cevap.')
  })

  it('running the seed again adds nothing', async () => {
    const before = await payload.count({ collection: 'email-templates' })
    await seedEmailTemplates((payload.db as unknown as PostgresAdapter).drizzle as never)
    expect((await payload.count({ collection: 'email-templates' })).totalDocs).toBe(before.totalDocs)
    expect((await seeded()).totalDocs).toBe(7)
  })

  it('every seeded body passes the editor validation (re-saved as it is)', async () => {
    for (const doc of (await seeded()).docs) {
      const saved = await payload.update({ collection: 'email-templates', id: doc.id, data: { body: doc.body } })
      expect(saved.body).toEqual(doc.body)
    }
  })

  it('refuses a button whose address is not http(s), mailto or tel', async () => {
    const body = structuredClone(EMAIL_TEMPLATES[0]!.body) as { root: { children: { type: string; fields?: { url: string } }[] } }
    body.root.children.find((n) => n.type === 'block')!.fields!.url = 'javascript:alert(1)'
    await expect(payload.create({ collection: 'email-templates', data: { name: `Kötü ${stamp}`, subject: 'x', body: body as never } })).rejects.toThrow()
  })

  it('names are unique', async () => {
    await expect(payload.create({ collection: 'email-templates', data: { name: 'Nazik ret', subject: 'x', body: EMAIL_TEMPLATES[6]!.body as never } })).rejects.toThrow()
  })

  it('staff only: an editor reads them, the public does not', async () => {
    expect((await payload.find({ collection: 'email-templates', overrideAccess: false, user: editor as never, limit: 1 })).totalDocs).toBeGreaterThanOrEqual(7)
    await expect(payload.find({ collection: 'email-templates', overrideAccess: false, user: null as never })).rejects.toThrow()
  })

  it('a template applied to a lead previews with the lead’s name and its buttons', async () => {
    const t = (await seeded()).docs.find((d) => d.name === 'İş tamamlandı')!
    const filled = fillTemplate({ subject: t.subject, body: t.body }, { name: 'Ayşe Yılmaz', service: 'Ahşap deck' })
    const mail = await payload.create({ collection: 'outgoing-emails', data: { to: 'ayse@example.com', subject: filled.subject, body: filled.body } })
    created.push({ collection: 'outgoing-emails', id: mail.id })
    const req = Object.assign(await createLocalReq({ user: editor as never }, payload), { method: 'GET', routeParams: { id: String(mail.id) } })
    const html = await (await outgoingEmailPreviewEndpoint.handler(req as never)).text()
    expect(html).toContain('Merhaba Ayşe Yılmaz,')
    expect(html).toContain('<strong>Ahşap deck</strong> işinizi tamamladık.')
    expect(html).toContain('[bakım önerisi, örneğin: yılda bir kez koruyucu yağ uygulanması]')
    expect(html).toMatch(/bgcolor="#0b7a3e"[^>]*><a href="https:\/\/g\.page\/r\/CR2jWPAf5IeAEBM\/review"[^>]*>Google&#39;da yorum yazın<\/a>/)
    expect(html).toMatch(/border:2px solid #0b7a3e[^>]*><a href="https:\/\/wa\.me\/905322958416"[^>]*>WhatsApp&#39;tan yazın<\/a>/)
  })
})
