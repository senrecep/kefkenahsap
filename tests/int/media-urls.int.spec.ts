// #165: every media URL the admin shows (original, sizes, list/edit thumbnail) points at the CDN, never /api/media/file;
// private lead photos keep going through Payload's authenticated file route.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const created: { collection: 'media' | 'lead-photos'; id: number }[] = []
const IMG = path.join(os.tmpdir(), 'kefken-media-urls', 'deck.webp')
const CDN = process.env.MEDIA_PUBLIC_URL!

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 700, height: 500, channels: 3, background: { r: 90, g: 80, b: 60 } } }).webp().toFile(IMG)
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  for (const { collection, id } of created) await payload.delete({ collection, id }).catch(() => {})
})

it('media url, size urls and the admin thumbnail are CDN urls', async () => {
  const { id } = await payload.create({ collection: 'media', data: {}, filePath: IMG, context: { skipAi: true } })
  created.push({ collection: 'media', id })
  const doc = await payload.findByID({ collection: 'media', id, depth: 0 })

  const urls = [doc.url, doc.thumbnailURL, ...Object.values(doc.sizes ?? {}).map((s) => s?.url).filter(Boolean)]
  expect(urls.length).toBeGreaterThan(2)
  for (const url of urls) {
    expect(url).not.toMatch(/\/api\/media\/file/)
    expect(url!.startsWith(`${CDN}/`)).toBe(true)
  }
  expect(doc.thumbnailURL).toBe(doc.sizes?.w320?.url)
})

it('lead photo thumbnails stay behind the authenticated file route', async () => {
  const photo = await payload.create({ collection: 'lead-photos', data: {}, filePath: IMG })
  created.push({ collection: 'lead-photos', id: photo.id })
  expect(photo.thumbnailURL).toMatch(/\/api\/lead-photos\/file\//)
  expect(photo.thumbnailURL!.startsWith(CDN)).toBe(false)
})
