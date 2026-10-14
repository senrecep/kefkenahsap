// Public pages need photos. CI starts from an empty DB, so seed a small approved set once, before the server
// renders (and caches) anything. A DB that already holds the launch seed is left untouched.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload } from 'payload'
import sharp from 'sharp'

import { PAGE_SIZE } from '../../src/lib/gallery/query'
import config from '../../src/payload.config.js'

const COUNT = PAGE_SIZE * 2 + 1 // enough for "page 2" plus a next cursor

export default async function globalSetup() {
  const payload = await getPayload({ config })
  const approved = await payload.count({ collection: 'media', where: { status: { equals: 'approved' } } })
  if (approved.totalDocs >= COUNT) return

  const dir = path.join(os.tmpdir(), 'kefken-e2e-photos')
  mkdirSync(dir, { recursive: true })
  const category = await payload.create({ collection: 'categories', locale: 'tr', data: { name: 'E2E Deck', slug: 'e2e-deck', _status: 'published' } })
  await payload.update({ collection: 'categories', id: category.id, locale: 'en', data: { name: 'E2E Decking', slug: 'e2e-decking' } })
  for (let i = 0; i < COUNT; i++) {
    // Mixed landscape/portrait, large enough for the hero fallback (≥1280 wide, landscape).
    const [width, height] = i % 3 === 2 ? [900, 1200] : [1600, 900]
    const file = path.join(dir, `e2e-${i}.webp`)
    await sharp({ create: { width, height, channels: 3, background: { r: 90 + (i % 7) * 20, g: 80, b: 60 } } }).webp().toFile(file)
    const doc = await payload.create({
      collection: 'media',
      locale: 'tr',
      filePath: file,
      context: { skipAi: true },
      data: { status: 'approved', title: `E2E fotoğraf ${i}`, alt: `E2E deneme fotoğrafı ${i}`, seoFilename: `e2e-foto-${i}`, category: category.id },
    })
    await payload.update({ collection: 'media', id: doc.id, locale: 'en', data: { title: `E2E photo ${i}`, alt: `E2E test photo ${i}` } })
  }
}
