// #37: the public homepage never shows an unapproved photo, even when an editor picked one as hero or cover.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { homepageQuery } from '@/lib/home/sections'
import config from '@/payload.config'
import type { Homepage } from '@/payload-types'

let payload: Payload
let pendingId: number
let categoryId: number | undefined
let before: Homepage

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const dir = path.join(os.tmpdir(), 'kefken-home-access')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'pending.webp')
  await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 140, g: 100, b: 60 } } }).webp().toFile(file)
  const media = await payload.create({ collection: 'media', data: { alt: 'bekleyen', status: 'pending' }, filePath: file, context: { skipAi: true } })
  pendingId = media.id
  before = await payload.findGlobal({ slug: 'homepage', draft: true })
})

afterAll(async () => {
  // Shared dev DB: put the homepage back exactly as it was.
  await payload.updateGlobal({ slug: 'homepage', data: { layout: before.layout ?? [], _status: before._status ?? 'draft' } })
  if (categoryId) await payload.delete({ collection: 'categories', id: categoryId }).catch(() => {})
  await payload.delete({ collection: 'media', id: pendingId }).catch(() => {})
})

describe('homepage public reads', () => {
  it('a pending hero image is not populated (the page falls back to an approved photo)', async () => {
    await payload.updateGlobal({ slug: 'homepage', data: { _status: 'published', layout: [{ blockType: 'hero', image: pendingId }] } })
    const staff = await payload.findGlobal({ slug: 'homepage', depth: 1, draft: false })
    expect(typeof (staff.layout?.[0] as { image: unknown }).image).toBe('object') // control: the admin view populates it
    const pub = await payload.findGlobal({ ...homepageQuery, locale: 'tr' })
    const image = (pub.layout?.[0] as { image: unknown }).image
    expect(typeof image === 'object' && image !== null).toBe(false)
  })

  it('a pending category cover is not populated for the public', async () => {
    const cat = await payload.create({ collection: 'categories', data: { name: 'Erişim testi', _status: 'published', cover: pendingId } })
    categoryId = cat.id
    const res = await payload.find({ collection: 'categories', where: { id: { equals: cat.id } }, depth: 1, overrideAccess: false })
    expect(typeof res.docs[0]?.cover).not.toBe('object')
  })
})
