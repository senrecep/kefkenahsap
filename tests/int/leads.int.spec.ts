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
  it('sets retention to two years and e-mails the business', async () => {
    const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const lead = await payload.create({
      collection: 'leads',
      data: { name: `Ayşe ${stamp}`, phone: '905321112233', consentKvkk: true, service: 'Deck', message: '<b>merhaba</b>' },
    })
    created.push({ collection: 'leads', id: lead.id })
    const years = (new Date(lead.retentionUntil!).getTime() - new Date(lead.createdAt).getTime()) / (365.25 * 24 * 3600e3)
    expect(years).toBeGreaterThan(1.99)
    expect(years).toBeLessThan(2.01)
    expect(send).toHaveBeenCalledTimes(1)
    const mail = send.mock.calls[0]![0] as { to: string; html: string; subject: string }
    expect(mail.to).toBe('notify@test.local')
    expect(mail.subject).toContain('Deck')
    expect(mail.html).not.toContain('<b>merhaba</b>') // escaped
    send.mockRestore()
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
