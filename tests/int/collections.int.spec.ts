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
  // An owner must exist first: in an empty database the first account is promoted to admin by design.
  const owner = await payload.create({
    collection: 'users',
    data: { email: `owner-${stamp}@test.local`, password: 'x-strong-pass', role: 'admin' },
  })
  cleanup.push({ collection: 'users', id: owner.id })
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

describe('review follow-ups', () => {
  it('approving an image that already has Turkish alt text works with a status-only update', async () => {
    const m = await payload.create({ collection: 'media', locale: 'tr', data: { alt: 'Mevcut alt metin' }, filePath: IMG })
    cleanup.push({ collection: 'media', id: m.id })
    const ok = await payload.update({ collection: 'media', id: m.id, locale: 'tr', data: { status: 'approved' } })
    expect(ok.status).toBe('approved')
  })

  it('an English edit of an approved image never overwrites the Turkish text', async () => {
    const m = await payload.create({ collection: 'media', locale: 'tr', data: { alt: 'Türkçe alt', title: 'Türkçe başlık', status: 'approved' }, filePath: IMG })
    cleanup.push({ collection: 'media', id: m.id })
    await payload.update({ collection: 'media', id: m.id, locale: 'en', data: { title: 'English title', alt: 'English alt' } })
    const all = (await payload.findByID({ collection: 'media', id: m.id, locale: 'all' as never, depth: 0 })) as unknown as { title: Record<string, string> }
    expect(all.title).toEqual({ tr: 'Türkçe başlık', en: 'English title' })
  })

  it('locale "all" cannot approve while blanking the Turkish alt', async () => {
    const m = await payload.create({ collection: 'media', locale: 'tr', data: { alt: 'Var' }, filePath: IMG })
    cleanup.push({ collection: 'media', id: m.id })
    await expect(
      payload.update({ collection: 'media', id: m.id, locale: 'all' as never, data: { status: 'approved', alt: { tr: '', en: 'x' } } as never }),
    ).rejects.toThrow(/Türkçe alt metni/)
  })

  it('renaming a category keeps its existing slug', async () => {
    const c = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `Sabit ${stamp}` } })
    cleanup.push({ collection: 'categories', id: c.id })
    const r = await payload.update({ collection: 'categories', id: c.id, locale: 'tr', data: { name: `Yeni ad ${stamp}` } })
    expect(r.slug).toBe(`sabit-${stamp}`)
  })

  it('an admin can be demoted while another admin remains', async () => {
    const a = await payload.create({ collection: 'users', data: { email: `a1-${stamp}@test.local`, password: 'x-strong-pass', role: 'admin' } })
    cleanup.push({ collection: 'users', id: a.id })
    const r = await payload.update({ collection: 'users', id: a.id, data: { role: 'editor' } })
    expect(r.role).toBe('editor')
  })
})

describe('accounts after the owner', () => {
  it('an editor created once an owner exists stays an editor', async () => {
    const { totalDocs } = await payload.count({ collection: 'users' })
    expect(totalDocs).toBeGreaterThan(0) // non-empty here, so an explicit editor stays an editor
    const u = await payload.create({ collection: 'users', data: { email: `late-${stamp}@test.local`, password: 'x-strong-pass', role: 'editor' } })
    cleanup.push({ collection: 'users', id: u.id })
    expect(u.role).toBe('editor')
  })
})
