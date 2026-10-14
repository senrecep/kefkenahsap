// #25 leads: staff-only access, retention date, notification e-mail, private photos, purge job.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const stamp = Date.now()
const IMG = path.join(os.tmpdir(), 'kefken-leads', 'photo.webp')
const created: { collection: 'leads' | 'lead-photos'; id: number | string }[] = []

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 120, b: 60 } } }).webp().toFile(IMG)
  process.env.LEADS_NOTIFY_EMAIL = 'notify@test.local'
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})

describe('leads', () => {
  it('sets retention to two years, records consent time and e-mails the business', async () => {
    process.env.RESEND_API_KEY ||= 're_test'
    const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const lead = await payload.create({
      collection: 'leads',
      data: { name: `Ayşe ${stamp}`, phone: '905321112233', consentKvkk: true, consentTextVersion: 'kvkk-test', service: 'Deck', message: '<b>merhaba</b>' },
    })
    created.push({ collection: 'leads', id: lead.id })
    const years = (new Date(lead.retentionUntil!).getTime() - new Date(lead.createdAt).getTime()) / (365.25 * 24 * 3600e3)
    expect(years).toBeGreaterThan(1.99)
    expect(years).toBeLessThan(2.01)
    expect(send).toHaveBeenCalledTimes(1)
    const mail = send.mock.calls[0]![0] as { to: string; html: string; subject: string }
    expect(mail.to).toBe('notify@test.local')
    expect(mail.subject).toContain('Deck')
    expect(mail.subject).not.toContain('Ayşe') // no personal data in subjects (they show up in previews and logs)
    expect(Math.abs(new Date(lead.consentAt!).getTime() - new Date(lead.createdAt).getTime())).toBeLessThan(5000)
    expect(lead.consentTextVersion).toBe('kvkk-test')
    expect(mail.html).not.toContain('<b>merhaba</b>') // escaped
    send.mockRestore()
  })

  it('the e-mail shows the phone as +E.164 with call and WhatsApp links, and the visitor’s language', async () => {
    process.env.RESEND_API_KEY ||= 're_test'
    const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const lead = await payload.create({ collection: 'leads', data: { name: `Anna ${stamp}`, phone: '491701234567', consentKvkk: true, locale: 'de' } })
    created.push({ collection: 'leads', id: lead.id })
    const { html } = send.mock.calls[0]![0] as { html: string }
    expect(html).toContain('<a href="tel:+491701234567">+491701234567</a>')
    expect(html).toContain('<a href="https://wa.me/491701234567">WhatsApp</a>')
    expect(html).toMatch(/<b>Dil<\/b><\/td><td>de</)
    send.mockRestore()
  })

  it('skips the notification (no personal data to the console mailer) without a Resend key', async () => {
    const key = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const lead = await payload.create({ collection: 'leads', data: { name: `Mehmet ${stamp}`, phone: '905321112233', consentKvkk: true } })
    created.push({ collection: 'leads', id: lead.id })
    expect(send).not.toHaveBeenCalled()
    send.mockRestore()
    if (key) process.env.RESEND_API_KEY = key
  })

  it('is invisible to anonymous readers and not creatable through the API', async () => {
    await expect(payload.find({ collection: 'leads', overrideAccess: false })).rejects.toThrow(/izniniz yok|Forbidden/i)
    await expect(
      payload.create({ collection: 'leads', overrideAccess: false, data: { name: 'x', phone: '905321112233', consentKvkk: true } }),
    ).rejects.toThrow()
  })

  it('keeps photos private', async () => {
    const photo = await payload.create({ collection: 'lead-photos', data: {}, filePath: IMG })
    created.push({ collection: 'lead-photos', id: photo.id })
    expect(photo.url).toMatch(/^\/api\/lead-photos\/file\//) // served through Payload's access check, not the CDN
    await expect(payload.find({ collection: 'lead-photos', overrideAccess: false })).rejects.toThrow(/izniniz yok|Forbidden/i)
  })

  it('the purge job deletes expired leads and their photos, keeps the rest', async () => {
    const photo = await payload.create({ collection: 'lead-photos', data: {}, filePath: IMG })
    const old = await payload.create({
      collection: 'leads',
      data: { name: `Eski ${stamp}`, phone: '905321112233', consentKvkk: true, photos: [photo.id] },
    })
    // Backdate past retention (the hook sets it on create).
    await payload.update({ collection: 'leads', id: old.id, data: { retentionUntil: '2020-01-01T00:00:00.000Z' } })
    const fresh = await payload.create({ collection: 'leads', data: { name: `Yeni ${stamp}`, phone: '905321112233', consentKvkk: true } })
    created.push({ collection: 'leads', id: fresh.id })

    await payload.jobs.queue({ task: 'purgeExpiredLeads', input: {} })
    await payload.jobs.run()

    await expect(payload.findByID({ collection: 'leads', id: old.id })).rejects.toThrow()
    await expect(payload.findByID({ collection: 'lead-photos', id: photo.id })).rejects.toThrow()
    expect((await payload.findByID({ collection: 'leads', id: fresh.id })).id).toBe(fresh.id)
  })
})
