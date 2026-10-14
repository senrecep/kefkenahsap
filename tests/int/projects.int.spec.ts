// #23 projects, references, pages, redirects.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const stamp = Date.now()
const IMG = path.join(os.tmpdir(), 'kefken-projects', 'p.webp')
const cleanup: { collection: 'media' | 'projects' | 'references' | 'pages' | 'redirects'; id: number | string }[] = []

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 120, g: 80, b: 40 } } }).webp().toFile(IMG)
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  for (const c of cleanup.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})

describe('projects', () => {
  it('keeps the gallery order as saved and derives a Turkish slug', async () => {
    const ids: (number | string)[] = []
    for (let i = 0; i < 3; i++) {
      const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      cleanup.push({ collection: 'media', id: m.id })
      ids.push(m.id)
    }
    const order = [ids[2]!, ids[0]!, ids[1]!]
    const p = await payload.create({
      collection: 'projects',
      locale: 'tr',
      data: { title: `Riva Havuz Kenarı Deck ${stamp}`, gallery: order as number[], city: 'İstanbul', district: 'Beykoz', year: 2019 },
    })
    cleanup.push({ collection: 'projects', id: p.id })
    expect(p.slug).toBe(`riva-havuz-kenari-deck-${stamp}`)
    expect((p.gallery ?? []).map((g) => (typeof g === 'object' ? g.id : g))).toEqual(order)
  })

  it('drafts are hidden from the public', async () => {
    const p = await payload.create({ collection: 'projects', draft: true, data: { title: `Taslak proje ${stamp}` } })
    cleanup.push({ collection: 'projects', id: p.id })
    const anon = await payload.find({ collection: 'projects', overrideAccess: false, where: { id: { equals: p.id } } })
    expect(anon.docs).toHaveLength(0)
  })
})

describe('references', () => {
  it('lists projects linked to a reference through the join', async () => {
    const ref = await payload.create({ collection: 'references', data: { name: `Riva Konakları ${stamp}` } })
    cleanup.push({ collection: 'references', id: ref.id })
    const p = await payload.create({ collection: 'projects', data: { title: `Riva iskele ${stamp}`, reference: ref.id, _status: 'published' } })
    cleanup.push({ collection: 'projects', id: p.id })
    const r = await payload.findByID({ collection: 'references', id: ref.id, depth: 0 })
    expect((r.projects?.docs ?? []).map((d) => (typeof d === 'object' ? d.id : d))).toContain(p.id)
  })
})

describe('redirects', () => {
  it('stores manual 301 redirects', async () => {
    const r = await payload.create({ collection: 'redirects', data: { from: `/eski-${stamp}/`, to: { type: 'custom', url: '/tr' }, type: '301' } })
    cleanup.push({ collection: 'redirects', id: r.id })
    expect(r.type).toBe('301')
  })
})
