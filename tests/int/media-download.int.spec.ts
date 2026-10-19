// #230: GET /api/media/:id/download — staff only, the stored (watermarked) original as a JPEG attachment at full size.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { createLocalReq, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mediaDownloadEndpoint } from '@/endpoints/mediaDownload'
import { mediaBucket, readObject } from '@/lib/media/renameStored'

let payload: Payload
const IMG = path.join(os.tmpdir(), 'kefken-download', 'download.webp')
const created: { collection: 'media' | 'users'; id: number }[] = []

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 1500, height: 1000, channels: 3, background: { r: 140, g: 100, b: 70 } } }).webp().toFile(IMG)
  const { default: config } = await import('@/payload.config')
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})

const get = async (user: unknown, id: string) => {
  const req = Object.assign(await createLocalReq({ user: user as never }, payload), { method: 'GET', routeParams: { id } })
  return mediaDownloadEndpoint.handler(req as never)
}

describe('GET /api/media/:id/download (#230)', () => {
  it('refuses anyone who is not signed-in staff', async () => {
    const m = await payload.create({ collection: 'media', data: {}, filePath: IMG, context: { skipAi: true } })
    created.push({ collection: 'media', id: m.id })
    expect((await get(null, String(m.id))).status).toBe(401)
    expect((await get({ id: 999, collection: 'users', email: 'x@local.test' }, String(m.id))).status).toBe(403)
  })

  it('404s an unknown or malformed id', async () => {
    const staff = await staffUser()
    expect((await get(staff, '987654321')).status).toBe(404)
    expect((await get(staff, '../1')).status).toBe(404)
  })

  it('serves the stored watermarked original as a JPEG attachment at the stored size', async () => {
    const staff = await staffUser()
    const m = await payload.create({ collection: 'media', data: { seoFilename: 'ahşap-deck-test' }, filePath: IMG, context: { skipAi: true } })
    created.push({ collection: 'media', id: m.id })
    expect(m.watermark).toBe('applied')
    const res = await get(staff, String(m.id))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="ahsap-deck-test.jpg"')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const jpeg = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(jpeg).metadata()
    // The stored original, read independently from the bucket: same pixels' size (the upload was 1500×1000).
    const { s3, bucket } = mediaBucket()
    const stored = await readObject(s3, bucket, m.prefix, m.filename!)
    expect(stored.ok).toBe(true)
    const storedMeta = await sharp(stored.ok ? stored.value : Buffer.alloc(0)).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', storedMeta.width, storedMeta.height])
    expect([meta.width, meta.height]).toEqual([1500, 1000])
  })
})

async function staffUser() {
  const email = `download-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@local.test`
  const user = await payload.create({ collection: 'users', data: { email, password: `pw-${Date.now()}`, name: 'Download', role: 'editor' } })
  created.push({ collection: 'users', id: user.id })
  return { ...user, collection: 'users' }
}
