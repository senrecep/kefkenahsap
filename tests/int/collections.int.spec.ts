// #22 core collections: roles, public visibility, publish gate, slugs, placeholders.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

let payload: Payload
let editor: User
const IMG = path.join(os.tmpdir(), 'kefken-core', 'red.webp')
const cleanup: { collection: 'media' | 'categories' | 'tags' | 'users'; id: number | string }[] = []
const stamp = Date.now()

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .webp()
    .toFile(IMG)
  payload = await getPayload({ config: await config })
  editor = await payload.create({
    collection: 'users',
    data: { email: `editor-${stamp}@test.local`, password: 'x-strong-pass', name: 'Editör', role: 'editor' },
  })
  cleanup.push({ collection: 'users', id: editor.id })
})

afterAll(async () => {
  for (const c of cleanup.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})

describe('roles', () => {
  it('an editor cannot create users', async () => {
    await expect(
      payload.create({
        collection: 'users',
        overrideAccess: false,
        user: editor,
        data: { email: `x-${stamp}@test.local`, password: 'x-strong-pass' },
      }),
    ).rejects.toThrow()
  })

  it('an editor cannot promote themselves to admin', async () => {
    const r = await payload.update({
      collection: 'users',
      id: editor.id,
      overrideAccess: false,
      user: editor,
      data: { role: 'admin' },
    })
    expect(r.role).toBe('editor')
  })
})

describe('media', () => {
  it('computes an LQIP data URL and a dominant colour on upload', async () => {
    const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
    cleanup.push({ collection: 'media', id: m.id })
    expect(m.status).toBe('pending')
    expect(m.lqip).toMatch(/^data:image\/webp;base64,/)
    expect(m.dominantColor).toMatch(/^#[0-9a-f]{6}$/)
    // red-ish source → red channel dominates
    expect(parseInt(m.dominantColor!.slice(1, 3), 16)).toBeGreaterThan(150)
  })

  it('refuses to approve without Turkish alt text, then approves with it', async () => {
    const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
    cleanup.push({ collection: 'media', id: m.id })
    await expect(payload.update({ collection: 'media', id: m.id, data: { status: 'approved' } })).rejects.toThrow(
      /Türkçe alt metni/,
    )
    const ok = await payload.update({
      collection: 'media',
      id: m.id,
      locale: 'tr',
      data: { status: 'approved', alt: 'Kırmızı test görseli' },
    })
    expect(ok.status).toBe('approved')
  })

  it('the public only sees approved media', async () => {
    const pending = await payload.create({ collection: 'media', data: { title: `gizli-${stamp}` }, filePath: IMG })
    cleanup.push({ collection: 'media', id: pending.id })
    const anon = await payload.find({
      collection: 'media',
      overrideAccess: false,
      where: { id: { equals: pending.id } },
    })
    expect(anon.docs).toHaveLength(0)
    const staff = await payload.find({
      collection: 'media',
      overrideAccess: false,
      user: editor,
      where: { id: { equals: pending.id } },
    })
    expect(staff.docs).toHaveLength(1)
  })
})

describe('categories and tags', () => {
  it('derives localized slugs from names (Turkish transliteration)', async () => {
    const c = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `Köprü ve İskele ${stamp}` } })
    cleanup.push({ collection: 'categories', id: c.id })
    expect(c.slug).toBe(`kopru-ve-iskele-${stamp}`)
    const en = await payload.update({ collection: 'categories', id: c.id, locale: 'en', data: { name: `Bridges and Piers ${stamp}` } })
    expect(en.slug).toBe(`bridges-and-piers-${stamp}`)
  })

  it('the public does not see draft categories', async () => {
    const c = await payload.create({ collection: 'categories', data: { name: `Taslak ${stamp}` }, draft: true })
    cleanup.push({ collection: 'categories', id: c.id })
    const anon = await payload.find({ collection: 'categories', overrideAccess: false, where: { id: { equals: c.id } } })
    expect(anon.docs).toHaveLength(0)
  })

  it('creates tags on an axis with an automatic slug', async () => {
    const t = await payload.create({ collection: 'tags', locale: 'tr', data: { name: `Iroko ${stamp}`, axis: 'wood' } })
    cleanup.push({ collection: 'tags', id: t.id })
    expect(t.slug).toBe(`iroko-${stamp}`)
  })
})
