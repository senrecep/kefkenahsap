// #254: admin-written e-mails. Draft → "Gönder" once (POST /api/outgoing-emails/:id/send), Resend mocked at payload.sendEmail.
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { outgoingEmailPreviewEndpoint, outgoingEmailSendEndpoint } from '@/endpoints/outgoingEmail'
import config from '@/payload.config'

let payload: Payload
let staff: Record<string, unknown>
const created: { collection: 'outgoing-emails' | 'users'; id: number }[] = []
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
  const user = await payload.create({ collection: 'users', data: { email: `outgoing-${stamp}@local.test`, password: `pw-${stamp}`, name: 'Outgoing', role: 'editor' } })
  created.push({ collection: 'users', id: user.id })
  staff = { ...user, collection: 'users' }
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function draft(subject = `Talebiniz hakkında — Deck ${stamp}`) {
  const doc = await payload.create({
    collection: 'outgoing-emails',
    data: { to: 'ayse@example.com', toName: 'Ayşe Yılmaz', subject, body: body('Merhaba Ayşe Hanım, keşif için yarın uygunuz.') },
  })
  created.push({ collection: 'outgoing-emails', id: doc.id })
  return doc
}

const call = async (endpoint: typeof outgoingEmailSendEndpoint, method: string, user: unknown, id: number | string) => {
  const req = Object.assign(await createLocalReq({ user: user as never }, payload), { method, routeParams: { id: String(id) } })
  return endpoint.handler(req as never)
}
const send = (user: unknown, id: number | string) => call(outgoingEmailSendEndpoint, 'POST', user, id)
const mockResend = () => {
  process.env.RESEND_API_KEY ||= 're_test'
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

  it('without a Resend key nothing is sent or logged, and the draft stays a draft', async () => {
    const key = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    const spy = vi.spyOn(payload, 'sendEmail')
    const doc = await draft()
    expect((await send(staff, doc.id)).status).toBe(503)
    expect(spy).not.toHaveBeenCalled()
    expect((await payload.findByID({ collection: 'outgoing-emails', id: doc.id })).status).toBe('draft')
    if (key) process.env.RESEND_API_KEY = key
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
})
