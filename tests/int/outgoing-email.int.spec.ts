// #254: admin-written e-mails. Draft → "Gönder" once (POST /api/outgoing-emails/:id/send), Resend mocked at payload.sendEmail.
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { outgoingEmailPreviewEndpoint, outgoingEmailSendEndpoint, sendLimits } from '@/endpoints/outgoingEmail'
import config from '@/payload.config'

let payload: Payload
let staff: Record<string, unknown> // admin: may send to any address
let editor: Record<string, unknown> // only to the linked lead's own address
const created: { collection: 'outgoing-emails' | 'users' | 'leads'; id: number }[] = []
const stamp = Date.now()

const body = (t: string) =>
  ({
    root: {
      type: 'root',
      direction: null,
      format: '',
      indent: 0,
      version: 1,
      children: [{ type: 'paragraph', direction: null, format: '', indent: 0, version: 1, textFormat: 0, children: [{ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }],
    },
  }) as never

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const mk = async (role: 'admin' | 'editor') => {
    const u = await payload.create({ collection: 'users', data: { email: `outgoing-${role}-${stamp}@local.test`, password: `pw-${stamp}`, name: 'Outgoing', role } })
    created.push({ collection: 'users', id: u.id })
    return { ...u, collection: 'users' }
  }
  staff = await mk('admin')
  editor = await mk('editor')
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function draft(subject = `Talebiniz hakkında — Deck ${stamp}`, extra: { to?: string; lead?: number } = {}) {
  const doc = await payload.create({
    collection: 'outgoing-emails',
    data: { to: 'ayse@example.com', toName: 'Ayşe Yılmaz', subject, body: body('Merhaba Ayşe Hanım, keşif için yarın uygunuz.'), ...extra },
  })
  created.push({ collection: 'outgoing-emails', id: doc.id })
  return doc
}

const call = async (endpoint: typeof outgoingEmailSendEndpoint, method: string, user: unknown, id: number | string) => {
  const req = Object.assign(await createLocalReq({ user: user as never }, payload), { method, routeParams: { id: String(id) } })
  return endpoint.handler(req as never)
}
const send = (user: unknown, id: number | string) => call(outgoingEmailSendEndpoint, 'POST', user, id)
async function lead(email: string, retentionUntil?: string) {
  const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never) // the lead notification
  const l = await payload.create({ collection: 'leads', data: { name: `Ayşe ${stamp}`, phone: '905321112233', email, consentKvkk: true } })
  send.mockRestore()
  if (retentionUntil) await payload.update({ collection: 'leads', id: l.id, data: { retentionUntil } })
  created.push({ collection: 'leads', id: l.id })
  return l
}
const mockResend = () => {
  process.env.RESEND_API_KEY ||= 're_test'
  process.env.NEXT_PUBLIC_SITE_URL ||= 'https://www.kefkenahsap.com'
  return vi.spyOn(payload, 'sendEmail').mockResolvedValue({ id: 're_1' } as never)
}

describe('outgoing e-mails (#254)', () => {
  it('a new document is a draft with a two-year retention date, whatever the client sends', async () => {
    const doc = await payload.create({
      collection: 'outgoing-emails',
      overrideAccess: false,
      user: staff as never,
      data: { to: 'a@example.com', subject: 's', body: body('x'), status: 'sent', sentAt: '2020-01-01T00:00:00.000Z', retentionUntil: '2099-01-01T00:00:00.000Z' } as never,
    })
    created.push({ collection: 'outgoing-emails', id: doc.id })
    expect(doc.status).toBe('draft')
    expect(doc.sentAt).toBeFalsy()
    const years = (new Date(doc.retentionUntil!).getTime() - new Date(doc.createdAt).getTime()) / (365.25 * 24 * 3600e3)
    expect(years).toBeGreaterThan(1.99)
    expect(years).toBeLessThan(2.01)
  })

  it('sends a draft once: from info@, reply-to info@, BCC to the owner, branded HTML + text', async () => {
    process.env.LEADS_NOTIFY_EMAIL = 'owner@test.local'
    const spy = mockResend()
    const doc = await draft()
    const res = await send(staff, doc.id)
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(1)
    const mail = spy.mock.calls[0]![0] as Record<string, string>
    expect(mail.from).toBe('Kefken Ahşap Dekorasyon <info@kefkenahsap.com>')
    expect(mail.replyTo).toBe('info@kefkenahsap.com')
    expect(mail.bcc).toBe('owner@test.local')
    expect(mail.to).toBe('"Ayşe Yılmaz" <ayse@example.com>')
    expect(mail.subject).toBe(doc.subject)
    expect(mail.html).toContain('/brand/logo.png')
    expect(mail.html).toContain('Merhaba Ayşe Hanım, keşif için yarın uygunuz.')
    expect(mail.text.startsWith('Merhaba Ayşe Hanım, keşif için yarın uygunuz.\n\n--')).toBe(true)

    const after = await payload.findByID({ collection: 'outgoing-emails', id: doc.id })
    expect(after.status).toBe('sent')
    expect(after.sentAt).toBeTruthy()

    const again = await send(staff, doc.id)
    expect(again.status).toBe(409)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('two sends at the same moment deliver one e-mail', async () => {
    const spy = mockResend()
    const doc = await draft()
    const statuses = (await Promise.all([send(staff, doc.id), send(staff, doc.id)])).map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('a Resend failure is stored as "Hata" with the reason and never resent', async () => {
    process.env.RESEND_API_KEY ||= 're_test'
    const spy = vi.spyOn(payload, 'sendEmail').mockRejectedValue(new Error('Error sending email: 422 validation_error - Invalid `to` field'))
    const doc = await draft()
    const res = await send(staff, doc.id)
    expect(res.status).toBe(502)
    const after = await payload.findByID({ collection: 'outgoing-emails', id: doc.id })
    expect(after.status).toBe('failed')
    expect(after.error).toContain('Invalid `to` field')
    expect((await send(staff, doc.id)).status).toBe(409)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('without a Resend key or site URL nothing is sent or logged, and the draft stays a draft', async () => {
    const spy = mockResend()
    const sentDoc = await draft()
    expect((await send(staff, sentDoc.id)).status).toBe(200)
    spy.mockClear()
    for (const name of ['RESEND_API_KEY', 'NEXT_PUBLIC_SITE_URL']) {
      const value = process.env[name]
      delete process.env[name]
      const doc = await draft()
      expect((await send(staff, doc.id)).status).toBe(503)
      expect((await send(staff, sentDoc.id)).status).toBe(409) // "already sent" is answered first
      expect((await payload.findByID({ collection: 'outgoing-emails', id: doc.id })).status).toBe('draft')
      process.env[name] = value
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('editors send only to the linked lead’s own address; admins anywhere', async () => {
    const l = await lead(`ayse-${stamp}@example.com`)
    const spy = mockResend()
    const ok = await draft(undefined, { lead: l.id, to: `AYSE-${stamp}@Example.com` })
    const other = await draft(undefined, { lead: l.id, to: 'someone@example.com' })
    const loose = await draft(undefined, { to: `ayse-${stamp}@example.com` })
    for (const d of [other, loose]) {
      const res = await send(editor, d.id)
      expect(res.status).toBe(403)
      expect((await res.json()).message).toMatch(/talebin e-posta adresine/)
    }
    expect(spy).not.toHaveBeenCalled()
    expect((await send(editor, ok.id)).status).toBe(200)
    expect((await send(staff, other.id)).status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('sends the row as stored at the claim, not the copy read before it', async () => {
    const spy = mockResend()
    const doc = await draft('eski konu')
    await payload.update({ collection: 'outgoing-emails', id: doc.id, data: { subject: 'yeni konu' } })
    const read = payload.findByID.bind(payload)
    vi.spyOn(payload, 'findByID').mockImplementationOnce((async () => doc) as never).mockImplementation(read as never)
    expect((await send(staff, doc.id)).status).toBe(200)
    expect((spy.mock.calls[0]![0] as { subject: string }).subject).toBe('yeni konu')
  })

  it('a hung Resend call ends as "Hata" after the timeout', async () => {
    process.env.RESEND_API_KEY ||= 're_test'
    vi.spyOn(payload, 'sendEmail').mockReturnValue(new Promise(() => {}) as never)
    const limit = sendLimits.timeoutMs
    sendLimits.timeoutMs = 50
    const doc = await draft()
    const res = await send(staff, doc.id)
    sendLimits.timeoutMs = limit
    expect(res.status).toBe(502)
    const after = await payload.findByID({ collection: 'outgoing-emails', id: doc.id })
    expect(after.status).toBe('failed')
    expect(after.error).toMatch(/zaman aşımı/i)
  })

  it('a database error after the send never changes the answer about the e-mail', async () => {
    process.env.RESEND_API_KEY ||= 're_test'
    vi.spyOn(payload, 'sendEmail').mockRejectedValue(new Error('boom'))
    vi.spyOn(payload, 'update').mockRejectedValue(new Error('db down'))
    const doc = await draft()
    expect((await send(staff, doc.id)).status).toBe(502)
  })

  it('only admins delete a sent e-mail', async () => {
    mockResend()
    const sent = await draft()
    await send(staff, sent.id)
    const open = await draft()
    await expect(payload.delete({ collection: 'outgoing-emails', id: sent.id, overrideAccess: false, user: editor as never })).rejects.toThrow()
    await payload.delete({ collection: 'outgoing-emails', id: open.id, overrideAccess: false, user: editor as never })
    await payload.delete({ collection: 'outgoing-emails', id: sent.id, overrideAccess: false, user: staff as never })
    await expect(payload.findByID({ collection: 'outgoing-emails', id: sent.id })).rejects.toThrow()
  })

  it('refuses anyone who is not signed-in staff', async () => {
    const spy = mockResend()
    const doc = await draft()
    const outsider = { id: 999, collection: 'users', email: 'x@local.test' }
    expect((await send(null, doc.id)).status).toBe(401)
    expect((await send(outsider, doc.id)).status).toBe(403)
    expect((await call(outgoingEmailPreviewEndpoint, 'GET', null, doc.id)).status).toBe(401)
    expect((await call(outgoingEmailPreviewEndpoint, 'GET', outsider, doc.id)).status).toBe(403)
    expect((await send(staff, 987654321)).status).toBe(404)
    expect(spy).not.toHaveBeenCalled()
    await expect(payload.find({ collection: 'outgoing-emails', overrideAccess: false })).rejects.toThrow(/izniniz yok|Forbidden/i)
  })

  it('staff cannot flip the status through the API, and a sent e-mail can no longer be edited', async () => {
    mockResend()
    const doc = await draft()
    const edited = await payload.update({ collection: 'outgoing-emails', id: doc.id, overrideAccess: false, user: staff as never, data: { status: 'sent', subject: 'yeni konu' } as never })
    expect(edited.status).toBe('draft')
    expect(edited.subject).toBe('yeni konu')
    expect((await send(staff, doc.id)).status).toBe(200)
    await expect(payload.update({ collection: 'outgoing-emails', id: doc.id, overrideAccess: false, user: staff as never, data: { subject: 'sonradan' } })).rejects.toThrow()
  })

  it('preview returns the rendered e-mail in a sandboxed page', async () => {
    const doc = await draft()
    const res = await call(outgoingEmailPreviewEndpoint, 'GET', staff, doc.id)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('content-security-policy')).toMatch(/^sandbox;/)
    expect(await res.text()).toContain('Merhaba Ayşe Hanım')
  })

  it('the retention job deletes expired outgoing e-mails and keeps the rest', async () => {
    const old = await draft()
    await payload.update({ collection: 'outgoing-emails', id: old.id, data: { retentionUntil: '2020-01-01T00:00:00.000Z' } })
    const fresh = await draft()
    const job = await payload.jobs.queue({ task: 'purgeExpiredLeads', input: {} })
    await payload.jobs.runByID({ id: job.id })
    await expect(payload.findByID({ collection: 'outgoing-emails', id: old.id })).rejects.toThrow()
    expect((await payload.findByID({ collection: 'outgoing-emails', id: fresh.id })).id).toBe(fresh.id)
  })

  it('purging an expired lead also deletes the e-mails written to it', async () => {
    const l = await lead(`eski-${stamp}@example.com`, '2020-01-01T00:00:00.000Z')
    const reply = await draft(undefined, { lead: l.id, to: `eski-${stamp}@example.com` })
    const job = await payload.jobs.queue({ task: 'purgeExpiredLeads', input: {} })
    await payload.jobs.runByID({ id: job.id })
    await expect(payload.findByID({ collection: 'leads', id: l.id })).rejects.toThrow()
    await expect(payload.findByID({ collection: 'outgoing-emails', id: reply.id })).rejects.toThrow()
  })
})
