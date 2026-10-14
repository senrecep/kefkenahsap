// F0 spike verifications (#10 orderable join, #11 S3 + sizes, #12 per-locale slug uniqueness).
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

const TMP = path.join(os.tmpdir(), 'kefken-spike')
const files = ['a.webp', 'b.webp', 'c.webp'].map((f) => path.join(TMP, f))

let payload: Payload
const created: { media: (number | string)[]; categories: (number | string)[] } = { media: [], categories: [] }

beforeAll(async () => {
  mkdirSync(TMP, { recursive: true })
  // 800×600 sources: smaller than the 960+ sizes, so withoutEnlargement is exercised.
  for (const [i, f] of files.entries())
    await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120 + i * 40, g: 90, b: 60 } } })
      .webp()
      .toFile(f)
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  for (const id of created.media) await payload.delete({ collection: 'media', id }).catch(() => {})
  for (const id of created.categories) await payload.delete({ collection: 'categories', id }).catch(() => {})
})

describe('spike #11: S3 storage serves files straight from the public media URL', () => {
  it('stores the original and WebP sizes, never routes through /api/media/file', async () => {
    const doc = await payload.create({ collection: 'media', data: { alt: 'spike' }, filePath: files[0] })
    created.media.push(doc.id)
    expect(doc.url).toMatch(new RegExp(`^${process.env.MEDIA_PUBLIC_URL}/`))
    expect(doc.url).not.toContain('/api/media/file')
    expect(doc.mimeType).toBe('image/webp')
    const sizes = Object.values(doc.sizes ?? {}).filter((s) => s?.url)
    for (const s of sizes) expect(s!.mimeType).toBe('image/webp')
    // withoutEnlargement: no size wider than the original
    for (const s of sizes) expect(s!.width!).toBeLessThanOrEqual(doc.width!)
    const res = await fetch(doc.url!)
    expect(res.status).toBe(200)
  })
})

describe('spike #10: category → media join is orderable', () => {
  it('returns joined media sorted by the fractional order key', async () => {
    const cat = await payload.create({ collection: 'categories', data: { name: 'Spike', slug: `spike-${Date.now()}` } })
    created.categories.push(cat.id)
    const ids: (number | string)[] = []
    for (const f of files) {
      const m = await payload.create({ collection: 'media', data: { alt: path.basename(f), category: cat.id }, filePath: f })
      created.media.push(m.id)
      ids.push(m.id)
    }
    const joinedIds = async () => {
      const read = await payload.findByID({ collection: 'categories', id: cat.id, depth: 0 })
      return (read.media?.docs ?? []).map((d) => (typeof d === 'object' ? d.id : d))
    }
    // New documents are appended at the end, in insertion order.
    expect(await joinedIds()).toEqual(ids)
    // Moving the last item before the first via its fractional key (what drag-and-drop writes) reorders the join.
    const first = await payload.findByID({ collection: 'media', id: ids[0] })
    expect(first._media_media_order).toBeTruthy()
    await payload.update({ collection: 'media', id: ids[2], data: { _media_media_order: '0' } as never })
    expect(await joinedIds()).toEqual([ids[2], ids[0], ids[1]])
  })
})

describe('spike #12: localized slug uniqueness', () => {
  it('allows the same slug in different locales of one document', async () => {
    const slug = `ayni-${Date.now()}`
    const cat = await payload.create({ collection: 'categories', locale: 'tr', data: { name: 'Aynı', slug } })
    created.categories.push(cat.id)
    const en = await payload.update({ collection: 'categories', id: cat.id, locale: 'en', data: { name: 'Same', slug } })
    expect(en.slug).toBe(slug)
  })

  it('rejects a duplicate slug in the same locale', async () => {
    const slug = `cakisma-${Date.now()}`
    const a = await payload.create({ collection: 'categories', locale: 'tr', data: { name: 'A', slug } })
    created.categories.push(a.id)
    await expect(
      payload.create({ collection: 'categories', locale: 'tr', data: { name: 'B', slug } }),
    ).rejects.toThrow()
  })

  it('allows a different document to reuse a slug in another locale', async () => {
    const slug = `capraz-${Date.now()}`
    const a = await payload.create({ collection: 'categories', locale: 'tr', data: { name: 'TR', slug } })
    created.categories.push(a.id)
    const b = await payload.create({ collection: 'categories', locale: 'en', data: { name: 'EN', slug } }).then(
      (d) => (created.categories.push(d.id), 'allowed'),
      () => 'rejected',
    )
    // The unique index is (slug, _locale); URLs stay unambiguous because the locale prefixes the path.
    expect(b).toBe('allowed')
  })
})
